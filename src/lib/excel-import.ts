import * as XLSX from 'xlsx';
import { syncAllInstallationPhotos } from '@/utils/photoSync';
import { storage } from '@/lib/storage';
import type { Installation } from '@/types';

export interface ExcelImportResult {
  success: boolean;
  data?: Installation[];
  errors?: string[];
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
  
  // Starting photo sync for installations
  
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
      
      // Extrair storagePaths
      const storagePaths = installationPhotos
        .map(f => f.storagePath)
        .filter((path): path is string => !!path);
      
      if (storagePaths.length === 0) {
        continue;
      }
      
      // Sincronizar fotos
      // Syncing photos for installation
      
      await syncAllInstallationPhotos(
        projectId,
        installation.id,
        String(installation.codigo),
        storagePaths
      );
      
      successCount++;
    } catch (error) {
      // Error syncing photos - continue with next
      errorCount++;
      // Continuar mesmo se uma falhar
    }
  }
  
  // Sync completed
  
  return {
    total: installations.length,
    success: successCount,
    errors: errorCount
  };
}

export function importExcelFile(file: File, projectId?: string): Promise<ExcelImportResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    
    // 1. Validate file type (.xlsx)
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      resolve({
        success: false,
        errors: ['Arquivo inválido. Por favor, selecione um arquivo Excel (.xlsx)']
      });
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Ignore first sheet named "TODOS"
        const sheetNames = workbook.SheetNames.filter(name => name.toUpperCase() !== 'TODOS');
        
        if (sheetNames.length === 0) {
          resolve({
            success: false,
            errors: ['Nenhuma aba válida encontrada (todas as abas exceto "TODOS" são processadas)']
          });
          return;
        }

        const allInstallations: Installation[] = [];
        const requiredColumns = ['Tipologia', 'Código', 'Descrição', 'Quantidade'];

        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length <= 1) continue; // Skip empty sheets or sheets with only headers
          
          // Assume first row is headers
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];
          
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
            errors.push(`Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`);
            continue;
          }

          // Convert rows to objects with validation
          const validRows = rows.filter(row => 
            row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== '')
          );
          
          // 3. Check if there's at least 1 data row
          if (validRows.length === 0) {
            errors.push(`Aba "${sheetName}": Planilha vazia. Adicione pelo menos uma linha de dados`);
            continue;
          }
          
          validRows.forEach((row, rowIndex) => {
            const lineNumber = rowIndex + 2; // +2 because: +1 for 0-index, +1 for header row
            
            // Skip completely empty rows
            const tipologia = headerMap['tipologia'] ? (row[parseInt(headerMap['tipologia'])] || '').toString() : '';
            const descricao = headerMap['descricao'] ? (row[parseInt(headerMap['descricao'])] || '').toString() : '';
            
            if (!tipologia && !descricao) return; // Skip empty rows
            
            // Parse codigo
            const codigoValue = headerMap['codigo'] ? row[parseInt(headerMap['codigo'])] : null;
            const codigo = codigoValue !== null && codigoValue !== undefined && codigoValue !== '' 
              ? Number(codigoValue) 
              : 0;
            
            // 4. Validate quantidade is a number
            const quantidadeValue = headerMap['quantidade'] ? row[parseInt(headerMap['quantidade'])] : null;
            let quantidade = 0;
            
            if (quantidadeValue === null || quantidadeValue === undefined || quantidadeValue === '') {
              errors.push(`Aba "${sheetName}" - Linha ${lineNumber}: Quantidade inválida`);
            } else {
              const parsedQtd = Number(quantidadeValue);
              if (isNaN(parsedQtd)) {
                errors.push(`Aba "${sheetName}" - Linha ${lineNumber}: Quantidade inválida`);
              } else {
                quantidade = parsedQtd;
              }
            }
            
            // Create installation object
            const installation: Installation = {
              id: crypto.randomUUID(),
              project_id: projectId || '',
              tipologia,
              codigo,
              descricao,
              quantidade,
              pavimento: sheetName,
              installed: false,
              revisado: false,
              revisao: 0,
              updated_at: new Date().toISOString(),
              photos: []
            };
            
            // Add optional fields
            if (headerMap['diretriz_altura_cm'] && row[parseInt(headerMap['diretriz_altura_cm'])]) {
              const altura = Number(row[parseInt(headerMap['diretriz_altura_cm'])]);
              if (!isNaN(altura)) {
                installation.diretriz_altura_cm = altura;
              }
            }
            if (headerMap['diretriz_dist_batente_cm'] && row[parseInt(headerMap['diretriz_dist_batente_cm'])]) {
              const dist = Number(row[parseInt(headerMap['diretriz_dist_batente_cm'])]);
              if (!isNaN(dist)) {
                installation.diretriz_dist_batente_cm = dist;
              }
            }
            if (headerMap['observacoes'] && row[parseInt(headerMap['observacoes'])]) {
              installation.observacoes = row[parseInt(headerMap['observacoes'])].toString();
            }
            
            allInstallations.push(installation);
          });
        }

        // Final validation: check if we have any data
        if (allInstallations.length === 0 && errors.length === 0) {
          resolve({
            success: false,
            errors: ['Planilha vazia. Adicione pelo menos uma linha de dados']
          });
          return;
        }
        
        // Return result
        if (errors.length > 0) {
          resolve({
            success: false,
            errors
          });
        } else {
          resolve({
            success: true,
            data: allInstallations
          });
        }
      } catch (error) {
        resolve({
          success: false,
          errors: [`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]
        });
      }
    };

    reader.readAsArrayBuffer(file);
  });
}