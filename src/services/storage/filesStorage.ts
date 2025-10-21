import { supabase } from '@/integrations/supabase/client';

const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string;

export interface UploadResult {
  storagePath: string;
  uploadedAtISO: string;
}

function offlineError(): Error & { code: string } {
  const err = new Error('Offline: unable to upload to storage');
  (err as { code?: string }).code = 'OFFLINE';
  return err as Error & { code: string };
}

export async function uploadToStorage(
  file: File,
  ids: { projectId?: string; installationId?: string; id: string }
): Promise<UploadResult> {
  if (!navigator.onLine) {
    throw offlineError();
  }

  if (!bucket) {
    throw new Error('Supabase storage bucket not configured');
  }

  const storagePath = `${ids.projectId ?? 'noproj'}/${ids.installationId ?? 'noinst'}/${ids.id}-${file.name}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: true });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return { storagePath, uploadedAtISO: new Date().toISOString() };
}

export async function getSignedUrl(
  storagePath: string,
  expiresSec = 900
): Promise<{ url: string }> {
  if (!bucket) {
    throw new Error('Supabase storage bucket not configured');
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresSec);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message ?? 'Unknown error'}`);
  }

  return { url: data.signedUrl };
}

export async function deleteFromStorage(storagePath: string): Promise<void> {
  if (!bucket) {
    throw new Error('Supabase storage bucket not configured');
  }

  const { error } = await supabase.storage.from(bucket).remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

