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
  typology: string;
  code: string;
  description: string;
  height_guideline_cm: number;
  distance_from_frame_cm: number;
  installed: boolean;
  installed_at?: string;
  updated_at: string;
  observations: string;
  photos: string[];
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