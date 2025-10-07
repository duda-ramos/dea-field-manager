import { Installation, ProjectFile } from '@/types';
import { StorageManagerDexie as Storage } from '@/services/StorageManager';
import { uploadToStorage } from '@/services/storage/filesStorage';

/**
 * Migra imagens antigas do formato array de strings para ProjectFile
 */
export async function migrateInstallationPhotos(
  installation: Installation
): Promise<Installation> {
  // Se não houver fotos antigas, retorna a instalação como está
  if (!installation.photos?.length) {
    return installation;
  }

  try {
    const storage = Storage;
    const existingFiles = await storage.getFilesByInstallation(installation.id);
    const existingUrls = new Set(existingFiles.map(f => f.url));

    // Migra apenas fotos que ainda não foram convertidas
    const photosToMigrate = installation.photos.filter(url => !existingUrls.has(url));

    // Converte cada foto para o novo formato
    for (const photoUrl of photosToMigrate) {
      try {
        // Busca a imagem original
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        
        // Cria um arquivo com nome baseado na URL
        const filename = `peca_${installation.codigo}_${Date.now()}.${blob.type.split('/')[1]}`;
        const file = new File([blob], filename, { type: blob.type });
        
        // Faz upload do arquivo
        const id = crypto.randomUUID();
        const uploaded = await uploadToStorage(file, {
          projectId: installation.project_id,
          installationId: installation.id,
          id
        });

        // Salva o registro do arquivo
        const imageRecord: ProjectFile = {
          id,
          projectId: installation.project_id,
          project_id: installation.project_id,
          installationId: installation.id,
          installation_id: installation.id,
          name: filename,
          size: blob.size,
          type: blob.type,
          storagePath: uploaded.storagePath,
          storage_path: uploaded.storagePath,
          uploadedAt: uploaded.uploadedAtISO,
          uploaded_at: uploaded.uploadedAtISO,
          updatedAt: Date.now(),
          createdAt: Date.now(),
          _dirty: 0,
          _deleted: 0,
          url: photoUrl // Mantém URL original para referência
        };

        await storage.upsertFile(imageRecord);
      } catch (error) {
        console.error(`Erro ao migrar foto ${photoUrl}:`, error);
      }
    }

    // Limpa array de fotos antigas após migração
    const updatedInstallation = {
      ...installation,
      photos: []
    };
    await storage.upsertInstallation(updatedInstallation);

    return updatedInstallation;
  } catch (error) {
    console.error('Erro ao migrar fotos:', error);
    return installation;
  }
}