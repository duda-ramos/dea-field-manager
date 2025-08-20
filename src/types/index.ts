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
  created_at: string;
  updated_at: string;
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
}

export interface ItemVersion {
  id: string;
  itemId: string;
  snapshot: Omit<Installation, 'id' | 'revisado' | 'revisao'>;
  revisao: number;
  motivo: 'problema-instalacao' | 'revisao-conteudo' | 'desaprovado-cliente' | 'outros';
  descricao_motivo?: string;
  criadoEm: string;
}

export interface ProjectBudget {
  id: string;
  project_id: string;
  supplier: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface ProjectContact {
  id: string;
  project_id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface ProjectReport {
  id: string;
  project_id: string;
  generated_by: string;
  generated_at: string;
  file_path: string;
}