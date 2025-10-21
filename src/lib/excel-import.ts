import * as XLSX from 'xlsx';
import { z } from 'zod';
import { syncAllInstallationPhotos } from '@/utils/photoSync';
import { storage } from '@/lib/storage';
import type { Installation } from '@/types';

// Zod schema for validating Installation data from Excel
const InstallationSchema = z.object({
  tipologia: z.string().min(2, 'Tipologia deve ter no mínimo 2 caracteres'),
  codigo: z.number().positive('Código deve ser um número positivo'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  quantidade: z.number().positive('Quantidade deve ser maior que 0'),
  diretriz_altura_cm: z.number().optional(),
  diretriz_dist_batente_cm: z.number().optional(),
  pavimento: z.string().optional(),
  observacoes: z.string().optional()
});

interface ImportError {
  linha: number;
  campo: string;
  mensagem: string;
  valorEncontrado?: unknown;
}

export interface ExcelImportResult {
  success: boolean;
  data: Installation[] | null;
  errors: ImportError[];
  warnings?: string[];
  totalLinhas: number;
  linhasImportadas: number;
  linhasRejeitadas: number;
}

export interface PhotoSyncResult {
  total: number;
  success: number;
  errors: number;
}

/**
 * Sincroniza fotos importadas com a galeria do projeto
 * Para cada instalação, busca suas fotos e sincroniza com o álbum do projeto
 */
export async function syncImportedPhotosToGallery(
  projectId: string,
  installations: Installation[]
): Promise<PhotoSyncResult> {
  let successCount = 0;
  let errorCount = 0;
  
  for (const installation of installations) {
    try {
      // Buscar arquivos da instalação
      const projectFiles = await storage.getFilesByProject(projectId);
      
      // Filtrar por installationId e tipo imagem
      const installationPhotos = projectFiles.filter(f => {
        if (f.installationId !== installation.id) return false;

        const type = typeof f.type === 'string' ? f.type.toLowerCase() : '';
        return type === 'image' || type.startsWith('image/');
      });
      
      // Se não tem fotos, pular
      if (installationPhotos.length === 0) {
        continue;
      }
      
      // Extrair metadados das fotos (storagePath, size, type)
      const photoMetadata = installationPhotos
        .filter(f => f.storagePath) // Apenas fotos com storagePath válido
        .map(f => ({
          storagePath: f.storagePath!,
          size: f.size || 0,
          type: typeof f.type === 'string' ? f.type : 'image/jpeg'
        }));
      
      if (photoMetadata.length === 0) {
        continue;
      }
      
      // Sincronizar fotos com metadados completos
      await syncAllInstallationPhotos(
        projectId,
        installation.id,
        String(installation.codigo),
        photoMetadata
      );
      
      successCount++;
    } catch (error) {
      console.error(`❌ Erro ao sincronizar fotos da instalação ${installation.codigo}:`, error);
      errorCount++;
      // Continuar mesmo se uma falhar
    }
  }
  
  return {
    total: installations.length,
    success: successCount,
    errors: errorCount
  };
}

export function importExcelFile(file: File, projectId?: string): Promise<ExcelImportResult> {
  return new Promise((resolve) => {
    const errors: ImportError[] = [];
    const warnings: string[] = [];
    let totalLinhas = 0;
    let linhasImportadas = 0;
    let linhasRejeitadas = 0;
    
    // 1. Validate file type (.xlsx)
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      resolve({
        success: false,
        data: null,
        errors: [{
          linha: 0,
          campo: 'arquivo',
          mensagem: 'Arquivo inválido. Por favor, selecione um arquivo Excel (.xlsx)'
        }],
        totalLinhas: 0,
        linhasImportadas: 0,
        linhasRejeitadas: 0
      });
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Ignore first sheet named "TODOS"
        const sheetNames = workbook.SheetNames.filter(name => name.toUpperCase() !== 'TODOS');
        
        if (sheetNames.length === 0) {
          resolve({
            success: false,
            data: null,
            errors: [{
              linha: 0,
              campo: 'planilha',
              mensagem: 'Nenhuma aba válida encontrada (todas as abas exceto "TODOS" são processadas)'
            }],
            totalLinhas: 0,
            linhasImportadas: 0,
            linhasRejeitadas: 0
          });
          return;
        }

        const allInstallations: Installation[] = [];

        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length <= 1) continue; // Skip empty sheets or sheets with only headers
          
          // Assume first row is headers
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as unknown[][];
          
          // 2. Validate required columns
          const headerMap: Record<string, string> = {};
          headers.forEach((header, index) => {
            const normalizedHeader = header?.toString().toLowerCase().trim();
            if (normalizedHeader?.includes('tipologia') || normalizedHeader?.includes('tipo')) {
              headerMap['tipologia'] = index.toString();
            }
            if (normalizedHeader?.includes('codigo') || normalizedHeader?.includes('código')) {
              headerMap['codigo'] = index.toString();
            }
            if (normalizedHeader?.includes('descricao') || normalizedHeader?.includes('descrição') || normalizedHeader?.includes('description')) {
              headerMap['descricao'] = index.toString();
            }
            if (normalizedHeader?.includes('quantidade') || normalizedHeader?.includes('qtd')) {
              headerMap['quantidade'] = index.toString();
            }
            if (normalizedHeader?.includes('altura') || normalizedHeader?.includes('height')) {
              headerMap['diretriz_altura_cm'] = index.toString();
            }
            if (normalizedHeader?.includes('distancia') || normalizedHeader?.includes('distância') || normalizedHeader?.includes('batente')) {
              headerMap['diretriz_dist_batente_cm'] = index.toString();
            }
            if (normalizedHeader?.includes('observac') || normalizedHeader?.includes('obs')) {
              headerMap['observacoes'] = index.toString();
            }
          });
          
          // Check for missing required columns
          const missingColumns: string[] = [];
          if (!headerMap['tipologia']) missingColumns.push('Tipologia');
          if (!headerMap['codigo']) missingColumns.push('Código');
          if (!headerMap['descricao']) missingColumns.push('Descrição');
          if (!headerMap['quantidade']) missingColumns.push('Quantidade');
          
          if (missingColumns.length > 0) {
            errors.push({
              linha: 1,
              campo: 'colunas',
              mensagem: `Aba "${sheetName}": Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`
            });
            continue;
          }

          // Convert rows to objects with validation
          const validRows = rows.filter(row => 
            row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== '')
          );
          
          // 3. Check if there's at least 1 data row
          if (validRows.length === 0) {
            errors.push({
              linha: 0,
              campo: 'dados',
              mensagem: `Aba "${sheetName}": Planilha vazia. Adicione pelo menos uma linha de dados`
            });
            continue;
          }
          
          // Process rows in small chunks to avoid blocking the UI for large files
          for (let rowIndex = 0; rowIndex < validRows.length; rowIndex++) {
            // Yield to event loop every 400 rows
            if (rowIndex > 0 && rowIndex % 400 === 0) {
              await new Promise<void>((r) => setTimeout(r, 0));
            }

            const row = validRows[rowIndex];
            const lineNumber = rowIndex + 2; // +2 because: +1 for 0-index, +1 for header row
            totalLinhas++;
            
            // Skip completely empty rows
            const tipologia = headerMap['tipologia'] ? (row[parseInt(headerMap['tipologia'])] || '').toString().trim() : '';
            const descricao = headerMap['descricao'] ? (row[parseInt(headerMap['descricao'])] || '').toString().trim() : '';
            
            if (!tipologia && !descricao) {
              totalLinhas--; // Don't count completely empty rows
              continue;
            }
            
            // Parse all values
            const codigoValue = headerMap['codigo'] ? row[parseInt(headerMap['codigo'])] : null;
            const codigo = codigoValue !== null && codigoValue !== undefined && codigoValue !== '' 
              ? Number(codigoValue) 
              : NaN;
            
            const quantidadeValue = headerMap['quantidade'] ? row[parseInt(headerMap['quantidade'])] : null;
            const quantidade = quantidadeValue !== null && quantidadeValue !== undefined && quantidadeValue !== ''
              ? Number(quantidadeValue)
              : NaN;
            
            const alturaValue = headerMap['diretriz_altura_cm'] ? row[parseInt(headerMap['diretriz_altura_cm'])] : null;
            const altura = alturaValue !== null && alturaValue !== undefined && alturaValue !== ''
              ? Number(alturaValue)
              : undefined;
            
            const distValue = headerMap['diretriz_dist_batente_cm'] ? row[parseInt(headerMap['diretriz_dist_batente_cm'])] : null;
            const dist = distValue !== null && distValue !== undefined && distValue !== ''
              ? Number(distValue)
              : undefined;
            
            const observacoes = headerMap['observacoes'] && row[parseInt(headerMap['observacoes'])]
              ? row[parseInt(headerMap['observacoes'])].toString().trim()
              : undefined;
            
            // Build validation object
            const rowData: Record<string, unknown> = {
              tipologia,
              codigo,
              descricao,
              quantidade,
              pavimento: sheetName
            };
            
            if (altura !== undefined) rowData.diretriz_altura_cm = altura;
            if (dist !== undefined) rowData.diretriz_dist_batente_cm = dist;
            if (observacoes) rowData.observacoes = observacoes;
            
            // Validate with Zod
            const validation = InstallationSchema.safeParse(rowData);
            
            if (!validation.success) {
              // Collect all validation errors for this row
              validation.error.errors.forEach(err => {
                const campo = err.path[0]?.toString() || 'desconhecido';
                const valorEncontrado = rowData[campo];
                
                errors.push({
                  linha: lineNumber,
                  campo,
                  mensagem: `Aba "${sheetName}" - Linha ${lineNumber}: ${err.message} (valor: ${valorEncontrado === undefined || valorEncontrado === null || (typeof valorEncontrado === 'number' && isNaN(valorEncontrado)) ? 'vazio' : valorEncontrado})`,
                  valorEncontrado
                });
              });
              linhasRejeitadas++;
              continue; // Skip invalid row
            }
            
            // Create installation object with validated data
            const installation: Installation = {
              id: crypto.randomUUID(),
              project_id: projectId || '',
              tipologia: validation.data.tipologia,
              codigo: validation.data.codigo,
              descricao: validation.data.descricao,
              quantidade: validation.data.quantidade,
              pavimento: sheetName,
              installed: false,
              revisado: false,
              revisao: 0,
              updated_at: new Date().toISOString(),
              photos: []
            };
            
            // Add optional fields from validated data
            if (validation.data.diretriz_altura_cm !== undefined) {
              installation.diretriz_altura_cm = validation.data.diretriz_altura_cm;
            }
            if (validation.data.diretriz_dist_batente_cm !== undefined) {
              installation.diretriz_dist_batente_cm = validation.data.diretriz_dist_batente_cm;
            }
            if (validation.data.observacoes) {
              installation.observacoes = validation.data.observacoes;
            }
            
            allInstallations.push(installation);
            linhasImportadas++;
          }
        }

        // Final validation: check if we have any data
        if (allInstallations.length === 0 && errors.length === 0) {
          resolve({
            success: false,
            data: null,
            errors: [{
              linha: 0,
              campo: 'dados',
              mensagem: 'Planilha vazia. Adicione pelo menos uma linha de dados'
            }],
            totalLinhas: 0,
            linhasImportadas: 0,
            linhasRejeitadas: 0
          });
          return;
        }
        
        // Return result
        if (allInstallations.length === 0 && errors.length > 0) {
          // All rows were rejected
          resolve({
            success: false,
            data: null,
            errors,
            warnings,
            totalLinhas,
            linhasImportadas,
            linhasRejeitadas
          });
        } else if (errors.length > 0) {
          // Partial success - some rows imported, some rejected
          warnings.push(`${linhasRejeitadas} linha(s) foram rejeitadas devido a erros de validação`);
          resolve({
            success: true,
            data: allInstallations,
            errors,
            warnings,
            totalLinhas,
            linhasImportadas,
            linhasRejeitadas
          });
        } else {
          // Complete success
          resolve({
            success: true,
            data: allInstallations,
            errors: [],
            warnings,
            totalLinhas,
            linhasImportadas,
            linhasRejeitadas
          });
        }
      } catch (error) {
        resolve({
          success: false,
          data: null,
          errors: [{
            linha: 0,
            campo: 'arquivo',
            mensagem: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          }],
          totalLinhas: 0,
          linhasImportadas: 0,
          linhasRejeitadas: 0
        });
      }
    };

    reader.readAsArrayBuffer(file);
  });
}