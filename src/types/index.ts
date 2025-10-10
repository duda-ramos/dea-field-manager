export interface Project {
  id: string;
  name: string;
  client: string;
  city: string;
  code: string;
  status: 'planning' | 'in-progress' | 'completed';
  installation_date?: string;
  inauguration_date?: string;
  owner: string;
  suppliers: string[];
  project_files_link?: string; // New field for project files link
  installation_time_estimate_days?: number; // Estimativa de tempo de instalação em dias úteis
  created_at: string;
  updated_at: string;
  user_id?: string;
  deleted_at?: string | null;
  archived_at?: string | null;
  permanent_deletion_at?: string | null;
  // Local timestamp for compatibility
  updatedAt?: number;
  createdAt?: number;
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}

export interface Installation {
  id: string;
  project_id: string;
  // Campos obrigatórios
  tipologia: string;
  codigo: number;
  descricao: string;
  quantidade: number;
  pavimento: string;
  // Campos opcionais
  diretriz_altura_cm?: number;
  diretriz_dist_batente_cm?: number;
  observacoes?: string;
  comentarios_fornecedor?: string;
  // Campos de pendências
  pendencia_tipo?: 'cliente' | 'fornecedor' | 'projetista';
  pendencia_descricao?: string;
  // Campos existentes mantidos
  installed: boolean;
  installed_at?: string;
  status?: 'ativo' | 'on hold' | 'cancelado' | 'pendente';
  updated_at: string;
  photos: string[];
  // Campos de revisão
  revisado: boolean;
  revisao: number;
  // Local timestamp for compatibility
  updatedAt?: number;
  createdAt?: number;
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}

export interface ItemVersion {
  id: string;
  installationId: string;
  itemId: string;
  snapshot: Omit<Installation, 'id' | 'revisado' | 'revisao'>;
  revisao: number;
  motivo: 'problema-instalacao' | 'revisao-conteudo' | 'desaprovado-cliente' | 'outros';
  descricao_motivo?: string;
  criadoEm: string;
  createdAt?: number;
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}

export interface ProjectBudget {
  id: string;
  project_id?: string;
  projectId?: string; // Legacy field for compatibility
  supplier: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at?: string;
  fileName?: string;
  file_name?: string; // Legacy field for compatibility with Supabase payloads
  filePath?: string;
  file_path?: string;
  fileSize?: number;
  file_size?: number;
  uploadedAt?: string;
  uploaded_at?: string;
  // Local timestamp for compatibility
  updatedAt?: number;
  createdAt?: number;
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}

export interface ProjectContact {
  id: string;
  project_id?: string;
  projetoId?: string; // Legacy field for compatibility
  name?: string;
  nome?: string; // Legacy field
  role?: string;
  tipo?: string; // Legacy field  
  phone?: string;
  telefone?: string; // Legacy field
  email?: string;
  atualizadoEm?: string; // Legacy field
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}

export interface ProjectReport {
  id: string;
  project_id: string;
  interlocutor: 'cliente' | 'fornecedor';
  generated_by: string;
  generated_at: string;
  arquivo_pdf?: Blob;
  arquivo_xlsx?: Blob;
  totais?: {
    pendentes: number;
    instalados: number;
    andamento: number;
  };
  observacoes?: string;
}

export interface ReportHistoryEntry {
  id: string;
  projectId: string;
  project_id?: string;
  payloadId?: string;
  fileName: string;
  format: 'pdf' | 'xlsx';
  interlocutor: 'cliente' | 'fornecedor';
  config?: any;
  size: number;
  generatedAt: string;
  generated_at?: string;
  generatedBy?: string;
  generated_by?: string;
  mimeType?: string;
  blob?: Blob;
  createdAt?: number;
  [key: string]: any;
}

export interface FileAttachment {
  id: string;
  projectId?: string;
  project_id?: string;
  installationId?: string;
  installation_id?: string;
  name: string;
  size: number;
  type: string;
  url?: string; // Legacy blob URLs or empty for storage-based files
  storagePath?: string; // Path in Supabase Storage
  storage_path?: string; // Legacy path in Supabase Storage
  uploadedAt?: string; // ISO string
  uploaded_at?: string; // Legacy field
  updatedAt?: number; // epoch ms for sync
  createdAt?: number;
  _dirty?: number;
  _deleted?: number;
  needsUpload?: number;
}

export type ProjectFile = FileAttachment;
