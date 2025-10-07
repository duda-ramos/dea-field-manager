import { EnhancedImageUpload } from './image-upload/EnhancedImageUpload';
import type { ProjectFile } from '@/types';

interface ProjectUnifiedGalleryProps {
  projectId: string;
  onNavigateToInstallation?: (installationId: string) => void;
}

export function ProjectUnifiedGallery({ 
  projectId,
  onNavigateToInstallation
}: ProjectUnifiedGalleryProps) {
  return (
    <EnhancedImageUpload
      projectId={projectId}
      context="projeto"
      onImageClick={(image) => {
        if (image.installationId && onNavigateToInstallation) {
          onNavigateToInstallation(image.installationId);
        }
      }}
    />
  );
}
