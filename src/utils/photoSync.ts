import { uploadToStorage } from '@/services/storage/filesStorage';
import { StorageManagerDexie } from '@/services/StorageManager';
import type { ProjectFile } from '@/types';

/**
 * Sincroniza uma foto da peça com o álbum de mídias do projeto
 */
export async function syncPhotoToProjectAlbum(
  projectId: string,
  installationId: string,
  installationCode: string,
  photoDataUrl: string,
  sequencial?: number
): Promise<void> {
  try {
    // Converter data URL para blob
    const response = await fetch(photoDataUrl);
    const blob = await response.blob();
    
    // Gerar nome do arquivo padronizado
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const nextSequencial = sequencial || await getNextSequentialForProject(projectId);
    const paddedSequencial = String(nextSequencial).padStart(3, '0');
    const fileName = `peca_${installationCode}_${date}_${paddedSequencial}.jpg`;
    
    // Criar arquivo
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    
    // Upload para o storage
    const uploadResult = await uploadToStorage(file, { 
      projectId, 
      installationId, 
      id: `img_${Date.now()}` 
    });
    
    // Criar registro no álbum do projeto
    const projectFile: Omit<ProjectFile, 'id'> = {
      projectId,
      installationId,
      name: fileName,
      type: 'image',
      size: file.size,
      storagePath: uploadResult.storagePath,
      uploadedAt: uploadResult.uploadedAtISO,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      _dirty: 1,
      _deleted: 0
    };
    
    // Salvar no banco de dados local
    await StorageManagerDexie.upsertFile({
      ...projectFile,
      id: `img_${Date.now()}_${Math.random()}`
    });
    
    console.log(`Foto da peça ${installationCode} sincronizada com o álbum do projeto`);
  } catch (error) {
    console.error('Erro ao sincronizar foto com álbum do projeto:', error);
  }
}

/**
 * Obtém o próximo número sequencial para fotos do projeto
 */
async function getNextSequentialForProject(projectId: string): Promise<number> {
  try {
    const files = await StorageManagerDexie.getFilesByProject(projectId);
    const imageFiles = files.filter(f => f.type === 'image');
    return imageFiles.length + 1;
  } catch (error) {
    console.error('Erro ao obter sequencial:', error);
    return 1;
  }
}

/**
 * Sincroniza todas as fotos de uma peça com o álbum do projeto
 */
export async function syncAllInstallationPhotos(
  projectId: string,
  installationId: string,
  installationCode: string,
  photos: string[]
): Promise<void> {
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const sequencial = await getNextSequentialForProject(projectId);
    await syncPhotoToProjectAlbum(
      projectId,
      installationId,
      installationCode,
      photo,
      sequencial + i
    );
  }
}