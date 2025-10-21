const envBucket = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined) ?? '';

const DEFAULT_BUCKET = 'reports';

export type StorageReference =
  | { kind: 'path'; path: string }
  | { kind: 'publicUrl'; url: string };

export function getStorageBucket(): string {
  const trimmed = envBucket?.trim();
  return trimmed ? trimmed : DEFAULT_BUCKET;
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch {
    return value;
  }
}

export function normalizeStorageReference(
  fileRef: string | null | undefined,
  bucketName = getStorageBucket()
): StorageReference | null {
  if (!fileRef) {
    return null;
  }

  const trimmed = fileRef.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const isHttp = lower.startsWith('http://') || lower.startsWith('https://');

  if (!isHttp) {
    return { kind: 'path', path: trimmed.replace(/^\/+/, '') };
  }

  const marker = `/storage/v1/object/public/${bucketName}/`;
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex !== -1) {
    const path = trimmed.substring(markerIndex + marker.length);
    return { kind: 'path', path: decodePath(path) };
  }

  try {
    const url = new URL(trimmed);
    const altMarker = `/${bucketName}/`;
    const altIndex = url.pathname.indexOf(altMarker);
    if (altIndex !== -1) {
      const path = url.pathname.substring(altIndex + altMarker.length);
      return { kind: 'path', path: decodePath(path) };
    }
  } catch {
    // Ignore URL parsing errors and fall back to treating as public URL
  }

  return { kind: 'publicUrl', url: trimmed };
}
