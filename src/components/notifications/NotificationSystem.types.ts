export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  projectId?: string;
  category: 'sync' | 'project' | 'system' | 'budget' | 'contact';
}

export interface NotificationSystemProps {
  className?: string;
}
