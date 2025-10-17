export interface EditConflictAlertProps {
  conflictInfo: {
    recordType: string;
    recordName: string;
    localVersion: any;
    remoteVersion: any;
  };
  isOpen: boolean;
  onClose: () => void;
  onResolve: (useLocal: boolean) => void;
  isResolving?: boolean;
}
