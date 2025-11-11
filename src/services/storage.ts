import { supabase } from '@/integrations/supabase/client';
import { StorageManagerDexie } from '@/services/StorageManager';
import { urlCache } from '@/services/storage/urlCache';
import { blobCleanup } from '@/services/storage/blobCleanup';
import { logger } from '@/services/logger';
import type { ProjectFile } from '@/types';

export interface StorageUploadResult {
  storagePath: string;
  url?: string;
}

export interface SignedUrlResult {
  signedUrl: string;
  error?: string;
}

export class SupabaseStorageService {
  private readonly bucketName = 'attachments';

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    file: File, 
    projectId: string, 
    installationId?: string
  ): Promise<StorageUploadResult> {
    // Create folder structure: userId/projectId/installationId?/filename
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    let storagePath = `${user.id}/${projectId}`;
    if (installationId) {
      storagePath += `/${installationId}`;
    }
    storagePath += `/${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    return {
      storagePath: data.path
    };
  }

  /**
   * Generate signed URL for file access (usa cache automático)
   */
  async getSignedUrl(storagePath: string, _expiresIn: number = 900): Promise<SignedUrlResult> {
    // Usa cache de URLs para evitar regeneração constante
    const signedUrl = await urlCache.getSignedUrl(storagePath, this.bucketName);

    if (!signedUrl) {
      return { signedUrl: '', error: 'Failed to generate signed URL' };
    }

    return { signedUrl };
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucketName)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    // Remove do cache de URLs
    urlCache.invalidate(storagePath);
  }

  /**
   * Upload file and save metadata to Dexie
   */
  async uploadAndSaveFile(
    file: File,
    projectId: string,
    installationId?: string
  ): Promise<ProjectFile> {
    // Upload to Storage
    const { storagePath } = await this.uploadFile(file, projectId, installationId);

    // Save metadata to Dexie
    const timestamp = new Date().toISOString();
    const fileRecord: ProjectFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      project_id: projectId,
      installationId,
      installation_id: installationId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: '', // No longer storing URLs, only storage paths
      storagePath,
      storage_path: storagePath,
      uploadedAt: timestamp,
      uploaded_at: timestamp,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      _dirty: 1,
      _deleted: 0
    };

    await StorageManagerDexie.upsertFile(fileRecord);
    return fileRecord;
  }

  /**
   * Get file preview URL (usa cache automático)
   */
  async getFilePreviewUrl(file: ProjectFile): Promise<string> {
    if (!file.storage_path) {
      // Legacy file with blob URL
      return file.url;
    }

    // Usa cache de URLs
    const signedUrl = await urlCache.getSignedUrl(file.storage_path, this.bucketName);
    if (!signedUrl) {
      throw new Error('Failed to get preview URL');
    }

    return signedUrl;
  }

  /**
   * Delete file from storage and mark as deleted in Dexie
   */
  async deleteFileCompletely(fileId: string): Promise<void> {
    // Get file record
    const files = await StorageManagerDexie.getFilesByProject(''); // Get all files
    const file = files.find(f => f.id === fileId);
    
    if (!file) {
      throw new Error('File not found');
    }

    try {
      // Delete from storage if it has a storage path
      if (file.storage_path) {
        await this.deleteFile(file.storage_path);
      }

      // Mark as deleted in Dexie (tombstone)
      await StorageManagerDexie.deleteFile(fileId);
    } catch (error) {
      // If storage deletion fails, still mark as dirty for retry
      await StorageManagerDexie.deleteFile(fileId);
      throw error;
    }
  }

  /**
   * Migrate legacy file to storage
   */
  async migrateLegacyFile(file: ProjectFile): Promise<ProjectFile> {
    if (file.storage_path) {
      return file; // Already migrated
    }

    try {
      // Convert blob URL to File object
      const response = await fetch(file.url);
      const blob = await response.blob();
      const fileObject = new File([blob], file.name, { type: file.type });

      // Upload to storage
      const { storagePath } = await this.uploadFile(
        fileObject, 
        file.project_id, 
        file.installation_id
      );

      // Update record
      const updatedFile: ProjectFile = {
        ...file,
        projectId: file.projectId ?? file.project_id,
        project_id: file.project_id,
        installationId: file.installationId ?? file.installation_id,
        installation_id: file.installation_id,
        storagePath,
        storage_path: storagePath,
        uploadedAt: file.uploadedAt ?? file.uploaded_at,
        uploaded_at: file.uploaded_at ?? file.uploadedAt,
        url: '', // Clear old blob URL
        _dirty: 1
      };

      await StorageManagerDexie.upsertFile(updatedFile);
      
      // Limpa blob URL (previne memory leak)
      if (file.url.startsWith('blob:')) {
        blobCleanup.revoke(file.url);
      }

      return updatedFile;
    } catch (error) {
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Queue upload for offline processing
   */
  async queueOfflineUpload(file: File, projectId: string, installationId?: string): Promise<ProjectFile> {
    // Create local blob URL for immediate preview
    const blobUrl = URL.createObjectURL(file);
    
    // Rastreia blob URL para limpeza futura
    blobCleanup.track(blobUrl);

    const timestamp = new Date().toISOString();
    const fileRecord: ProjectFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      project_id: projectId,
      installationId,
      installation_id: installationId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: blobUrl,
      uploadedAt: timestamp,
      uploaded_at: timestamp,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      _dirty: 1, // Will be synced when online
      _deleted: 0
    };

    await StorageManagerDexie.upsertFile(fileRecord);
    return fileRecord;
  }

  /**
   * Valida se arquivo foi enviado corretamente
   */
  async validateUpload(storagePath: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(storagePath.substring(0, storagePath.lastIndexOf('/')), {
          search: storagePath.substring(storagePath.lastIndexOf('/') + 1)
        });

      if (error) {
        logger.error('storage', {
          message: 'Erro ao validar upload',
          error: error.message,
          storagePath
        });
        return false;
      }

      const exists = data && data.length > 0;
      
      if (!exists) {
        logger.warn('storage', {
          message: 'Arquivo não encontrado após upload',
          storagePath
        });
      }

      return exists;
    } catch (error) {
      logger.error('storage', {
        message: 'Exceção ao validar upload',
        error: error instanceof Error ? error.message : String(error),
        storagePath
      });
      return false;
    }
  }
}

export const storageService = new SupabaseStorageService();
