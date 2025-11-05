export type RevisionType = 'created' | 'edited' | 'restored' | 'deleted' | 'installed';

export interface InstallationBase {
  id: string;
  project_id: string;
  projectId?: string;
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

export type InstallationRevisionData = InstallationBase;

export interface InstallationRevision {
  timestamp: string;
  type: RevisionType;
  data: InstallationRevisionData;
}

export interface Installation extends InstallationBase {
  revisions?: InstallationRevision[];
}

export type InstallationVersionSnapshot = Omit<InstallationRevisionData, 'id' | 'revisado' | 'revisao'>;
