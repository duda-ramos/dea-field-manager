import * as XLSX from 'xlsx';
import { syncAllInstallationPhotos } from '@/utils/photoSync';
import { storage } from '@/lib/storage';
import type { Installation } from '@/types';

export interface ExcelImportResult {
  success: boolean;
  data: { pavimento: string; items: any[] }[];
  error?: string;
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
  
  console.log(`🔄 Iniciando sincronização de fotos para ${installations.length} instalações...`);
  
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
      console.log(`📸 Sincronizando ${storagePaths.length} foto(s) da instalação ${installation.codigo}...`);
      
      await syncAllInstallationPhotos(
        projectId,
        installation.id,
        String(installation.codigo),
        storagePaths
      );
      
      successCount++;
    } catch (error) {
      console.error(`❌ Erro ao sincronizar fotos da instalação ${installation.codigo}:`, error);
      errorCount++;
      // Continuar mesmo se uma falhar
    }
  }
  
  console.log(`✅ Sincronização concluída: ${successCount} sucessos, ${errorCount} erros`);
  
  return {
    total: installations.length,
    success: successCount,
    errors: errorCount
  };
}

export function importExcelFile(file: File): Promise<ExcelImportResult> {
  return new Promise((resolve) => {
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
            data: [],
            error: 'Nenhuma aba válida encontrada (todas as abas exceto "TODOS" são processadas)'
          });
          return;
        }

        const result: { pavimento: string; items: any[] }[] = [];

        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length <= 1) continue; // Skip empty sheets or sheets with only headers
          
          // Assume first row is headers
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];
          
          // Map headers to our expected field names
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

          // Convert rows to objects
          const items = rows
            .filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
            .map(row => {
              const item: any = {};
              
              // Map required fields
              item.tipologia = headerMap['tipologia'] ? (row[parseInt(headerMap['tipologia'])] || '').toString() : '';
              item.codigo = headerMap['codigo'] ? Number(row[parseInt(headerMap['codigo'])]) || 0 : 0;
              item.descricao = headerMap['descricao'] ? (row[parseInt(headerMap['descricao'])] || '').toString() : '';
              item.quantidade = headerMap['quantidade'] ? Number(row[parseInt(headerMap['quantidade'])]) || 0 : 0;
              
              // Map optional fields
              if (headerMap['diretriz_altura_cm'] && row[parseInt(headerMap['diretriz_altura_cm'])]) {
                item.diretriz_altura_cm = Number(row[parseInt(headerMap['diretriz_altura_cm'])]);
              }
              if (headerMap['diretriz_dist_batente_cm'] && row[parseInt(headerMap['diretriz_dist_batente_cm'])]) {
                item.diretriz_dist_batente_cm = Number(row[parseInt(headerMap['diretriz_dist_batente_cm'])]);
              }
              if (headerMap['observacoes'] && row[parseInt(headerMap['observacoes'])]) {
                item.observacoes = row[parseInt(headerMap['observacoes'])].toString();
              }
              
              return item;
            })
            .filter(item => item.tipologia || item.descricao); // Filter out completely empty rows

          if (items.length > 0) {
            result.push({
              pavimento: sheetName,
              items
            });
          }
        }

        resolve({
          success: true,
          data: result
        });
      } catch (error) {
        resolve({
          success: false,
          data: [],
          error: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        });
      }
    };

    reader.readAsArrayBuffer(file);
  });
}