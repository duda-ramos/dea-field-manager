import type { Installation, Project } from '@/types';

export interface ReportCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: ReportConfig, format: 'pdf' | 'xlsx') => Promise<Blob>;
  onShare: (blob: Blob, format: 'pdf' | 'xlsx', config: ReportConfig) => void;
  project: Project;
  installations: Installation[];
}

export interface ReportConfig {
  interlocutor: 'cliente' | 'fornecedor';
  sections: {
    pendencias: boolean;
    concluidas: boolean;
    emRevisao: boolean;
    emAndamento: boolean;
  };
  includeDetails: {
    photos: boolean;
    observations: boolean;
    supplierComments: boolean;
    timestamps: boolean;
    pavimentoSummary: boolean;
    storageChart: boolean;
    thumbnails: boolean;
  };
  groupBy: 'none' | 'pavimento' | 'tipologia';
  sortBy: 'codigo' | 'pavimento' | 'tipologia' | 'updated_at';
  visibleColumns: {
    pavimento: boolean;
    tipologia: boolean;
    codigo: boolean;
    descricao: boolean;
    status: boolean;
    observations: boolean;
    supplierComments: boolean;
    updatedAt: boolean;
    photos: boolean;
  };
  stats?: {
    pendencias: number;
    concluidas: number;
    emRevisao: number;
    emAndamento: number;
    total: number;
  };
}
