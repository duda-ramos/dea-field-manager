// @ts-nocheck - Legacy file sync with complex typing
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/db/indexedDb';
import { storageService } from '@/services/storage';
import type { ProjectFile } from '@/types';
import { logger } from '@/services/logger';
import { withRetry, createBatches } from './utils';

const PAGE_SIZE = 100;
const BATCH_SIZE = 50;

/**
 * Sync files with Supabase Storage
 */
export class FileSyncService {
  /**
   * Push local files to Supabase (metadata to DB, files to Storage)
   */
  async pushFiles(): Promise<{ pushed: number; errors: string[] }> {
    const dirtyFiles = await db.files.where('_dirty').equals(1).toArray();
    const errors: string[] = [];
    let pushed = 0;

    for (const file of dirtyFiles) {
      try {
        if (file._deleted) {
          // Handle deletion
          await this.handleFileDeletion(file);
        } else {
          // Handle upsert
          await this.handleFileUpsert(file);
        }
        
        // Clear dirty flag
        await db.files.update(file.id, { _dirty: 0 });
        pushed++;
      } catch (error) {
        logger.error('fileSync', `Failed to sync file ${file.id}`, error as Error, { fileId: file.id, fileName: file.name });
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { pushed, errors };
  }

  /**
   * Pull files metadata from Supabase DB
   */
  async pullFiles(lastPulledAt: number): Promise<{ pulled: number; errors: string[] }> {
    const errors: string[] = [];
    const allRemoteFiles: ProjectFile[] = [];
    let page = 0;
    let hasMore = true;

    // Fetch files in pages
    while (hasMore) {
      logger.debug(`Fetching files page ${page + 1} (offset ${page * PAGE_SIZE})`);
      
      const { data: remoteFiles, error } = await withRetry(
        async () => {
          const result = await supabase
            .from('files')
            .select('*')
            .gt('updated_at', new Date(lastPulledAt).toISOString())
            .order('updated_at', { ascending: true })
            .order('id', { ascending: true })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          
          if (result.error) {
            throw new Error(`Failed to pull files: ${result.error.message}`);
          }
          
          return result;
        },
        {},
        `Pull files page ${page + 1}`
      );

      if (error) {
        throw new Error(`Failed to pull files: ${error.message}`);
      }

      const filesCount = remoteFiles?.length || 0;
      logger.debug(`Fetched ${filesCount} files on page ${page + 1}`);
      
      if (remoteFiles && remoteFiles.length > 0) {
        allRemoteFiles.push(...remoteFiles);
      }
      
      hasMore = remoteFiles?.length === PAGE_SIZE;
      page++;
    }

    logger.debug(`Total files fetched: ${allRemoteFiles.length} across ${page} page(s)`);

    // Process files in batches
    const batches = createBatches(allRemoteFiles, BATCH_SIZE);
    let pulled = 0;

    for (const [batchIndex, batch] of batches.entries()) {
      logger.debug(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);
      
      const results = await Promise.allSettled(
        batch.map(async (remoteFile) => {
          const localFile = await db.files.get(remoteFile.id);
          
          if (!localFile || this.shouldUpdateLocal(localFile, remoteFile)) {
            // Convert remote file to local format
            const fileRecord: ProjectFile = {
              id: remoteFile.id,
              projectId: remoteFile.project_id,
              project_id: remoteFile.project_id,
              installationId: remoteFile.installation_id,
              installation_id: remoteFile.installation_id,
              name: remoteFile.name,
              size: remoteFile.size,
              type: remoteFile.type,
              url: remoteFile.url || '',
              storagePath: remoteFile.storage_path,
              storage_path: remoteFile.storage_path,
              uploadedAt: remoteFile.created_at,
              uploaded_at: remoteFile.created_at,
              updatedAt: new Date(remoteFile.updated_at).getTime(),
              createdAt: new Date(remoteFile.created_at).getTime(),
              _dirty: 0,
              _deleted: 0
            };

            await db.files.put(fileRecord);
            return { success: true, name: remoteFile.name };
          }
          return { success: true, name: remoteFile.name, skipped: true };
        })
      );

      // Process results
      for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') {
          if (!result.value.skipped) {
            pulled++;
          }
        } else {
          const remoteFile = batch[index];
          logger.error('fileSync', `Failed to process remote file`, result.reason as Error, { fileId: remoteFile.id, fileName: remoteFile.name });
          errors.push(`${remoteFile.name}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`);
        }
      }
    }

    return { pulled, errors };
  }

  /**
   * Upload pending files to Storage (for offline uploads)
   */
  async uploadPendingFiles(): Promise<{ uploaded: number; errors: string[] }> {
    // Find files that have blob URLs but no storage_path (offline uploads)
    const pendingFiles = await db.files
      .where('storage_path')
      .equals(undefined)
      .and(file => file.url.startsWith('blob:') && !file._deleted)
      .toArray();

    const errors: string[] = [];
    let uploaded = 0;

    for (const file of pendingFiles) {
      try {
        // Convert blob URL back to File object
        const response = await fetch(file.url);
        const blob = await response.blob();
        const fileObject = new File([blob], file.name, { type: file.type });

        // Upload to storage
        const { storagePath } = await withRetry(async () => {
          return await storageService.uploadFile(
            fileObject,
            file.project_id,
            file.installation_id
          );
        });

        // Update record with storage path and mark as dirty for next push
        await db.files.update(file.id, {
          storage_path: storagePath,
          storagePath: storagePath,
          url: '', // Clear blob URL
          _dirty: 1 // Mark for push to sync metadata
        });

        // Clean up blob URL
        URL.revokeObjectURL(file.url);
        
        uploaded++;
      } catch (error) {
        logger.error('fileSync', `Failed to upload pending file`, error, { fileId: file.id, fileName: file.name, filePath: file.url });
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { uploaded, errors };
  }

  private async handleFileDeletion(file: ProjectFile): Promise<void> {
    // Delete from storage if it exists
    if (file.storage_path) {
      try {
        await withRetry(async () => {
          return await storageService.deleteFile(file.storage_path);
        });
      } catch (error) {
        // Storage deletion failed, but continue with DB deletion
        console.warn(`Failed to delete file from storage: ${error}`);
      }
    }

    // Delete metadata from Supabase DB
    const { error } = await withRetry(async () => {
      return await supabase
        .from('files')
        .delete()
        .eq('id', file.id);
    });

    if (error) {
      throw new Error(`Failed to delete file metadata: ${error.message}`);
    }

    // Remove from local DB
    await db.files.delete(file.id);
  }

  private async handleFileUpsert(file: ProjectFile): Promise<void> {
    // Get current user for user_id
    const { data: { user } } = await withRetry(async () => {
      return await supabase.auth.getUser();
    });
    if (!user) throw new Error('User not authenticated');

    // Prepare data for Supabase (remove local-only fields)
    const {
      updatedAt: _updatedAt,
      createdAt: _createdAt,
      _dirty,
      _deleted,
      projectId: _projectId,
      installationId: _installationId,
      storagePath: _storagePath,
      uploadedAt,
      needsUpload: _needsUpload,
      ...fileData
    } = file;

    const supabaseFile = {
      ...fileData,
      user_id: user.id,
      updated_at: new Date().toISOString(),
      created_at: fileData.uploaded_at || uploadedAt // Use uploaded_at as created_at
    };

    // Upsert metadata to Supabase DB
    const { error } = await withRetry(async () => {
      return await supabase
        .from('files')
        .upsert(supabaseFile);
    });

    if (error) {
      throw new Error(`Failed to upsert file metadata: ${error.message}`);
    }
  }

  private shouldUpdateLocal(localFile: ProjectFile, remoteFile: ProjectFile): boolean {
    const localTimestamp = localFile.updatedAt || 0;
    const remoteTimestamp = new Date(remoteFile.updated_at).getTime();
    
    // Update if remote is newer (last-write-wins)
    return remoteTimestamp > localTimestamp;
  }
}

export const fileSyncService = new FileSyncService();
