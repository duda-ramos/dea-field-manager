import type { ReportConfig } from "./ReportCustomizationModal.types";

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  interlocutor: "cliente",
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
    thumbnails: false,
  },
  pdfOptions: {
    includePhotos: true,
    variant: "complete",
    maxPhotosPerItem: 3,
  },
  groupBy: "pavimento",
  sortBy: "codigo",
  visibleColumns: {
    pavimento: true,
    tipologia: true,
    codigo: true,
    descricao: true,
    status: true,
    observations: true,
    supplierComments: true,
    updatedAt: true,
    photos: true,
  },
};

export const REPORT_CONFIG_STORAGE_KEY = "report-config-preferences";
