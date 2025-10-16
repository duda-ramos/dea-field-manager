import type { ReportConfig } from './ReportCustomizationModal.types';

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  interlocutor: 'cliente',
  sections: {
    pendencias: true,
    concluidas: true,
    emRevisao: true,
    emAndamento: true,
  },
  includeDetails: {
    photos: true,
    observations: true,
    supplierComments: true,
    timestamps: true,
    pavimentoSummary: true,
    storageChart: true,
  },
  groupBy: 'pavimento',
  sortBy: 'codigo',
};

export const REPORT_CONFIG_STORAGE_KEY = 'report-config-preferences';
