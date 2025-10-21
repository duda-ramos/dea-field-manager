import React, { useEffect, useState } from 'react';
import { conflictStore } from '@/stores/conflictStore';
import { EditConflictAlert } from './EditConflictAlert';
import { resolveEditConflict } from '@/lib/conflictResolution';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

export function ConflictManager() {
  const {
    currentConflict,
    showConflictAlert,
    hideConflictAlert,
    resolveCurrentConflict,
    showConflictNotification,
    getPendingCount,
  } = conflictStore();

  const [isResolving, setIsResolving] = useState(false);

  // Show notification when component mounts if there are pending conflicts
  useEffect(() => {
    const pendingCount = getPendingCount();
    if (pendingCount > 0 && !showConflictAlert) {
      showConflictNotification();
    }
  }, []);

  const handleResolve = async (useLocal: boolean) => {
    if (!currentConflict) return;

    const { recordType, localVersion, remoteVersion } = currentConflict;
    
    setIsResolving(true);
    try {
      await resolveEditConflict(
        String(localVersion.id),
        recordType as any,
        useLocal,
        localVersion,
        remoteVersion
      );

      // Move to next conflict
      resolveCurrentConflict();
    } catch (_error) {
      // Error já tratado pelo toast
    } finally {
      setIsResolving(false);
    }
  };

  const handleClose = () => {
    hideConflictAlert();
  };

  if (!currentConflict) {
    return null;
  }

  return (
    <>
      <EditConflictAlert
        conflictInfo={currentConflict}
        isOpen={showConflictAlert}
        onClose={handleClose}
        onResolve={handleResolve}
        isResolving={isResolving}
      />
    </>
  );
}

/**
 * Badge component to show in header when conflicts are pending
 */
export function ConflictBadge() {
  const { currentConflict, showConflictAlert, getPendingCount } = conflictStore();
  const pendingCount = getPendingCount();

  if (pendingCount === 0) {
    return null;
  }

  const handleClick = () => {
    if (currentConflict && !showConflictAlert) {
      conflictStore.setState({ showConflictAlert: true });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 text-amber-600 hover:text-amber-700"
      onClick={handleClick}
    >
      <AlertTriangle className="h-4 w-4" />
      <span className="text-sm font-medium">
        {pendingCount} {pendingCount === 1 ? 'conflito' : 'conflitos'} pendente{pendingCount === 1 ? '' : 's'}
      </span>
    </Button>
  );
}