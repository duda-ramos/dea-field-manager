import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Installation, ItemVersion } from '@/types';

// Lazy load the RevisionHistoryModal component
const RevisionHistoryModal = lazy(() => 
  import('./RevisionHistoryModal').then(module => ({ 
    default: module.RevisionHistoryModal 
  }))
);

// Loading fallback component
const LoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="flex items-center gap-2 rounded-lg bg-background p-4 shadow-lg">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Carregando histórico...</span>
    </div>
  </div>
);

interface LazyRevisionHistoryModalProps {
  installation: Installation;
  revisions: ItemVersion[];
  isOpen: boolean;
  onClose: () => void;
  onRestore: (version: ItemVersion) => Promise<void>;
}

// Wrapper component that handles lazy loading
export function LazyRevisionHistoryModal(props: LazyRevisionHistoryModalProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RevisionHistoryModal {...props} />
    </Suspense>
  );
}