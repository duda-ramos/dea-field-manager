import { useEffect } from 'react';
import { EnhancedImageUpload } from './image-upload/EnhancedImageUpload';
import type { ProjectFile } from '@/types';
import { migrateInstallationPhotos } from '@/utils/migratePhotos';
import { StorageManagerDexie as Storage } from '@/services/StorageManager';
import { Installation } from '@/types';

interface InstallationImageGalleryProps {
  projectId: string;
  installationId: string;
  installationCode: string;
  onImagesChange?: (images: ProjectFile[]) => void;
  installation: Installation;
  onNavigateToInstallation?: (installationId: string) => void;
}

export function InstallationImageGallery({
  projectId,
  installationId,
  installationCode,
  onImagesChange,
  installation,
  onNavigateToInstallation
}: InstallationImageGalleryProps) {
  // Migração de imagens antigas
  useEffect(() => {
    const migratePhotos = async () => {
      if (installation.photos?.length) {
        const updatedInstallation = await migrateInstallationPhotos(installation);
        // Atualizar a instalação após migração
        await Storage.upsertInstallation(updatedInstallation);
      }
    };
    migratePhotos();
  }, [installation]);

  // Manipulador de mudanças nas imagens
  const handleImagesChange = (images: ProjectFile[]) => {
    const filtered = images.filter(img => img.installationId === installationId);
    onImagesChange?.(filtered);
  };

  return (
    <EnhancedImageUpload
      projectId={projectId}
      installationId={installationId}
      context={`peca_${installationCode}`}
      onImagesChange={handleImagesChange}
      onImageClick={(image) => {
        if (image.installationId && onNavigateToInstallation) {
          onNavigateToInstallation(image.installationId);
        }
      }}
    />
  );
}
