-- ═══════════════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Criar tabela public_report_links e estrutura de compartilhamento público
-- Data: 2025-10-15
-- Descrição: Esta migration cria toda a estrutura necessária para gerar links públicos
--            de relatórios, incluindo tabelas, índices, políticas RLS e funções.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Verificar se a tabela já existe antes de criar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'public_report_links') THEN
        RAISE NOTICE 'Criando tabela public_report_links...';
    ELSE
        RAISE NOTICE 'Tabela public_report_links já existe, pulando criação...';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CRIAR TABELA: public_report_links
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public_report_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES project_report_history(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}' -- Para extensibilidade futura (ex: restrições IP, proteção por senha)
);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CRIAR ÍNDICES para performance
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_public_links_token_hash 
  ON public_report_links(token_hash) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_public_links_expires_at 
  ON public_report_links(expires_at) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_public_links_report_id 
  ON public_report_links(report_id);

CREATE INDEX IF NOT EXISTS idx_public_links_created_by 
  ON public_report_links(created_by);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- HABILITAR RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public_report_links ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CRIAR POLÍTICAS RLS
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view their own public links" ON public_report_links;
DROP POLICY IF EXISTS "Users can create public links for their reports" ON public_report_links;
DROP POLICY IF EXISTS "Users can update their own public links" ON public_report_links;
DROP POLICY IF EXISTS "Public can access link data via valid token" ON public_report_links;

-- Policy 1: Usuários podem visualizar seus próprios links
CREATE POLICY "Users can view their own public links"
  ON public_report_links
  FOR SELECT
  USING (created_by = auth.uid());

-- Policy 2: Usuários podem criar links públicos para seus relatórios
CREATE POLICY "Users can create public links for their reports"
  ON public_report_links
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM project_report_history
      WHERE id = report_id AND user_id = auth.uid()
    )
  );

-- Policy 3: Usuários podem atualizar seus próprios links (para revogar)
CREATE POLICY "Users can update their own public links"
  ON public_report_links
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy 4: Acesso público via token (para usuários não autenticados)
CREATE POLICY "Public can access link data via valid token"
  ON public_report_links
  FOR SELECT
  TO anon
  USING (
    is_active = true AND
    expires_at > now() AND
    token_hash = current_setting('request.jwt.claim.token_hash', true)
  );

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CRIAR FUNÇÕES AUXILIARES
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Remover funções existentes se houver
DROP FUNCTION IF EXISTS increment_public_link_access(UUID, TEXT);
DROP FUNCTION IF EXISTS cleanup_expired_public_links();
DROP FUNCTION IF EXISTS get_public_report_access(TEXT);

-- Função 1: Incrementar contador de acessos
CREATE OR REPLACE FUNCTION increment_public_link_access(link_id UUID, token_hash TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.token_hash', token_hash, true);

  UPDATE public_report_links
  SET
    access_count = access_count + 1,
    last_accessed_at = now()
  WHERE
    id = link_id AND
    token_hash = current_setting('request.jwt.claim.token_hash', true) AND
    is_active = true AND
    expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Função 2: Limpar links expirados (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_public_links()
RETURNS void AS $$
BEGIN
  UPDATE public_report_links
  SET is_active = false
  WHERE 
    is_active = true AND
    expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função 3: Buscar acesso público ao relatório pelo hash do token
CREATE OR REPLACE FUNCTION get_public_report_access(token_hash TEXT)
RETURNS TABLE (
  link_id UUID,
  token_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER,
  report_id UUID,
  project_id UUID,
  file_url TEXT,
  file_name TEXT,
  format TEXT,
  interlocutor TEXT,
  generated_at TIMESTAMP WITH TIME ZONE,
  sections_included JSONB,
  stats JSONB
) AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.token_hash', token_hash, true);

  RETURN QUERY
  SELECT
    pl.id,
    pl.token_hash,
    pl.expires_at,
    pl.access_count,
    prh.id,
    prh.project_id,
    prh.file_url,
    prh.file_name,
    prh.format,
    prh.interlocutor,
    prh.generated_at,
    prh.sections_included,
    prh.stats
  FROM
    public_report_links pl
    INNER JOIN project_report_history prh ON pl.report_id = prh.id
  WHERE
    pl.token_hash = current_setting('request.jwt.claim.token_hash', true) AND
    pl.is_active = true AND
    pl.expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CRIAR TRIGGER para atualizar updated_at automaticamente
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Verificar se a função update_updated_at_column existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS update_public_report_links_updated_at ON public_report_links;
CREATE TRIGGER update_public_report_links_updated_at
  BEFORE UPDATE ON public_report_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CONCEDER PERMISSÕES
-- ═══════════════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION increment_public_link_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_public_link_access(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_public_links() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_report_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_public_report_access(TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CRIAR VIEW: public_report_access
-- ═══════════════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public_report_access;
CREATE OR REPLACE VIEW public_report_access AS
SELECT 
  pl.id as link_id,
  pl.token_hash,
  pl.expires_at,
  pl.access_count,
  prh.id as report_id,
  prh.project_id,
  prh.file_url,
  prh.file_name,
  prh.format,
  prh.interlocutor,
  prh.generated_at,
  prh.sections_included,
  prh.stats
FROM 
  public_report_links pl
  INNER JOIN project_report_history prh ON pl.report_id = prh.id
WHERE 
  pl.is_active = true AND
  pl.expires_at > now();

-- Conceder acesso SELECT na view para anon
GRANT SELECT ON public_report_access TO anon;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- ADICIONAR COMENTÁRIOS para documentação
-- ═══════════════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE public_report_links IS 'Armazena links públicos de compartilhamento para relatórios de projetos com expiração e rastreamento de acesso';
COMMENT ON COLUMN public_report_links.token_hash IS 'Hash SHA-256 do token de acesso público';
COMMENT ON COLUMN public_report_links.expires_at IS 'Timestamp de quando o link público expira';
COMMENT ON COLUMN public_report_links.is_active IS 'Se o link está atualmente ativo (pode ser revogado manualmente)';
COMMENT ON COLUMN public_report_links.access_count IS 'Número de vezes que o link público foi acessado';
COMMENT ON COLUMN public_report_links.metadata IS 'Objeto JSON para extensibilidade futura (restrições IP, proteção por senha, etc)';
COMMENT ON VIEW public_report_access IS 'View para acesso público a relatórios via tokens, une dados do link com dados do relatório';

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Esta query deve retornar:
-- - table_exists: true
-- - indices_count: 4
-- - policies_count: 4
-- - functions_count: 3
-- - view_exists: true
SELECT 
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'public_report_links') AS table_exists,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'public_report_links') AS indices_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'public_report_links') AS policies_count,
  (SELECT COUNT(*) FROM information_schema.routines 
   WHERE routine_name IN ('increment_public_link_access', 'cleanup_expired_public_links', 'get_public_report_access')
   AND routine_schema = 'public') AS functions_count,
  EXISTS (SELECT FROM information_schema.views WHERE table_name = 'public_report_access') AS view_exists;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- TESTE RÁPIDO (opcional - descomente para testar)
-- ═══════════════════════════════════════════════════════════════════════════════════════

/*
-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'public_report_links'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'public_report_links';

-- Verificar funções criadas
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('increment_public_link_access', 'cleanup_expired_public_links', 'get_public_report_access');
*/

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- FIM DA MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════════════