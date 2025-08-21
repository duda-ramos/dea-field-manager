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
  created_at: string;
  updated_at: string;
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
  // Campos existentes mantidos
  installed: boolean;
  installed_at?: string;
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
  itemId: string;
  snapshot: Omit<Installation, 'id' | 'revisado' | 'revisao'>;
  revisao: number;
  motivo: 'problema-instalacao' | 'revisao-conteudo' | 'desaprovado-cliente' | 'outros';
  descricao_motivo?: string;
  criadoEm: string;
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}

export interface ProjectBudget {
  id: string;
  project_id: string;
  supplier: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  // Local timestamp for compatibility
  updatedAt?: number;
  createdAt?: number;
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}

export interface ProjectContact {
  id: string;
  project_id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
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

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploaded_at: string;
  // Local timestamp for compatibility
  updatedAt?: number;
  createdAt?: number;
  // Sync flags
  _dirty?: number;
  _deleted?: number;
}