-- Create tables for DEA Manager sync system
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  city TEXT NOT NULL,
  code TEXT,
  status TEXT CHECK (status IN ('planning', 'in-progress', 'completed')) DEFAULT 'planning',
  installation_date TIMESTAMPTZ,
  inauguration_date TIMESTAMPTZ,
  owner_name TEXT,
  suppliers TEXT[],
  project_files_link TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Installations table
CREATE TABLE public.installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  tipologia TEXT NOT NULL,
  codigo INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  pavimento TEXT NOT NULL,
  diretriz_altura_cm INTEGER,
  diretriz_dist_batente_cm INTEGER,
  observacoes TEXT,
  comentarios_fornecedor TEXT,
  installed BOOLEAN DEFAULT false,
  installed_at TIMESTAMPTZ,
  photos TEXT[],
  revisado BOOLEAN DEFAULT false,
  revisao INTEGER DEFAULT 1,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Budgets table
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  supplier TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Item versions table
CREATE TABLE public.item_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installation_id UUID REFERENCES public.installations(id) ON DELETE CASCADE NOT NULL,
  snapshot JSONB NOT NULL,
  revisao INTEGER NOT NULL,
  motivo TEXT CHECK (motivo IN ('problema-instalacao', 'revisao-conteudo', 'desaprovado-cliente', 'outros')) NOT NULL,
  descricao_motivo TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Files table
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  installation_id UUID REFERENCES public.installations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT files_project_or_installation CHECK (
    (project_id IS NOT NULL AND installation_id IS NULL) OR 
    (project_id IS NULL AND installation_id IS NOT NULL)
  )
);

-- Enable Row Level Security on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for installations
CREATE POLICY "Users can view their own installations" ON public.installations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own installations" ON public.installations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own installations" ON public.installations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own installations" ON public.installations
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for contacts
CREATE POLICY "Users can view their own contacts" ON public.contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts" ON public.contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts" ON public.contacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" ON public.contacts
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for budgets
CREATE POLICY "Users can view their own budgets" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for item_versions
CREATE POLICY "Users can view their own item_versions" ON public.item_versions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own item_versions" ON public.item_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own item_versions" ON public.item_versions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own item_versions" ON public.item_versions
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for files
CREATE POLICY "Users can view their own files" ON public.files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" ON public.files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files" ON public.files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" ON public.files
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at);
CREATE INDEX idx_installations_user_id ON public.installations(user_id);
CREATE INDEX idx_installations_project_id ON public.installations(project_id);
CREATE INDEX idx_installations_updated_at ON public.installations(updated_at);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_project_id ON public.contacts(project_id);
CREATE INDEX idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX idx_budgets_project_id ON public.budgets(project_id);
CREATE INDEX idx_item_versions_user_id ON public.item_versions(user_id);
CREATE INDEX idx_item_versions_installation_id ON public.item_versions(installation_id);
CREATE INDEX idx_files_user_id ON public.files(user_id);
CREATE INDEX idx_files_project_id ON public.files(project_id);
CREATE INDEX idx_files_installation_id ON public.files(installation_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installations_updated_at BEFORE UPDATE ON public.installations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_versions_updated_at BEFORE UPDATE ON public.item_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();