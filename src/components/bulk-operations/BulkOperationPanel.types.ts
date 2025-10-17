import type { Installation, Project, ProjectBudget, ProjectContact } from '@/types';

export type BulkItem = Project | Installation | ProjectContact | ProjectBudget;

export interface BulkOperation {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  action: (items: BulkItem[]) => Promise<void>;
  requiresConfirmation?: boolean;
  destructive?: boolean;
  category: 'data' | 'sync' | 'export' | 'organize';
}

export interface BulkOperationPanelProps {
  items: BulkItem[];
  itemType: 'projects' | 'contacts' | 'budgets' | 'installations';
  onItemsChange?: (items: BulkItem[]) => void;
  className?: string;
}

export interface BulkProgress {
  total: number;
  completed: number;
  current?: string;
  errors: string[];
}
