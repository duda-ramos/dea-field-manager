import { StorageManagerDexie } from '@/services/StorageManager';
import type { ProjectFile } from '@/types';

/**
 * Sincroniza uma foto da peça com o álbum de mídias do projeto
 * IMPORTANTE: Usa storagePath existente, NÃO faz upload duplicado
 */
export async function syncPhotoToProjectAlbum(
  projectId: string,
  installationId: string,
  installationCode: string,
  storagePath: string,
  fileSize: number,
  fileType: string,
  sequencial?: number
): Promise<void> {
  try {
    console.log('📸 Sync com metadados:', { fileSize, fileType, fileName: `peca_${installationCode}` });
    console.log(`🔄 Sincronizando foto da peça ${installationCode} com álbum do projeto...`);
    console.log(`📁 Storage path: ${storagePath}`);
    
    // Gerar nome do arquivo padronizado: peca_[codigo]_[data]_[seq].jpg
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const nextSequencial = sequencial || await getNextSequentialForProject(projectId);
    const paddedSequencial = String(nextSequencial).padStart(3, '0');
    const fileName = `peca_${installationCode}_${date}_${paddedSequencial}.jpg`;
    
    console.log(`📝 Nome gerado: ${fileName}`);
    
    // Criar registro no álbum do projeto (apenas referência, sem upload)
    const projectFile: Omit<ProjectFile, 'id'> = {
      projectId,
      installationId,
      name: fileName,
      type: fileType, // Usar tipo MIME completo ao invés de 'image'
      size: fileSize, // Usar tamanho real ao invés de 0
      storagePath, // Usar storagePath existente diretamente
      url: '', // Adicionar campo url vazio
      uploadedAt: new Date().toISOString(),
      updatedAt: Date.now(),
      createdAt: Date.now(),
      _dirty: 1,
      _deleted: 0
    };
    
    // Salvar no banco de dados local com ID único
    const fileId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await StorageManagerDexie.upsertFile({
      ...projectFile,
      id: fileId
    });
    
    console.log(`✅ Foto da peça ${installationCode} sincronizada com o álbum do projeto (ID: ${fileId})`);
  } catch (error) {
    console.error(`❌ Erro ao sincronizar foto da peça ${installationCode}:`, error);
    // Erro isolado - não propaga para não quebrar o fluxo principal
  }
}

/**
 * Obtém o próximo número sequencial para fotos do projeto
 */
async function getNextSequentialForProject(projectId: string): Promise<number> {
  try {
    const files = await StorageManagerDexie.getFilesByProject(projectId);
    const imageFiles = files.filter(
      f => f.type === 'image' || (typeof f.type === 'string' && f.type.startsWith('image/'))
    );
    return imageFiles.length + 1;
  } catch (error) {
    console.error('Erro ao obter sequencial:', error);
    return 1;
  }
}

/**
 * Metadados de foto para sincronização
 */
export interface PhotoMetadata {
  storagePath: string;
  size: number;
  type: string;
}

/**
 * Sincroniza todas as fotos de uma peça com o álbum do projeto
 * IMPORTANTE: Recebe metadados completos das fotos, NÃO faz upload duplicado
 */
export async function syncAllInstallationPhotos(
  projectId: string,
  installationId: string,
  installationCode: string,
  photos: PhotoMetadata[] | string[]
): Promise<void> {
  // Normalizar entrada: aceita tanto PhotoMetadata[] quanto string[] (para compatibilidade)
  const photoMetadata: PhotoMetadata[] = photos.map(photo => {
    if (typeof photo === 'string') {
      // Compatibilidade com código antigo que passa apenas storagePath
      return {
        storagePath: photo,
        size: 0,
        type: 'image/jpeg'
      };
    }
    return photo;
  });
  
  console.log(`🔄 Iniciando sincronização de ${photoMetadata.length} foto(s) da peça ${installationCode}`);
  
  for (let i = 0; i < photoMetadata.length; i++) {
    const photo = photoMetadata[i];
    const sequencial = await getNextSequentialForProject(projectId);
    
    console.log(`📸 Sincronizando foto ${i + 1}/${photoMetadata.length}... (${photo.size} bytes, tipo: ${photo.type})`);
    
    // Sync não-bloqueante: falha em uma foto não quebra as outras
    await syncPhotoToProjectAlbum(
      projectId,
      installationId,
      installationCode,
      photo.storagePath,
      photo.size,
      photo.type,
      sequencial + i
    );
  }
  
  console.log(`✅ Sincronização concluída: ${photoMetadata.length} foto(s) processadas`);
}