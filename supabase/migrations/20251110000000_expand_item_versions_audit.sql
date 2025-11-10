-- Expandir tabela item_versions com campos de auditoria completa
-- Migration: Histórico e Auditoria de Instalações

-- 1. Adicionar novos campos à tabela item_versions
ALTER TABLE public.item_versions 
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS action_type TEXT CHECK (action_type IN ('created', 'updated', 'deleted', 'installed')),
  ADD COLUMN IF NOT EXISTS changes_summary JSONB,
  ADD COLUMN IF NOT EXISTS type TEXT;

-- 2. Atualizar constraint do campo motivo para incluir novos tipos
ALTER TABLE public.item_versions 
  DROP CONSTRAINT IF EXISTS item_versions_motivo_check;

ALTER TABLE public.item_versions
  ADD CONSTRAINT item_versions_motivo_check 
  CHECK (motivo IN (
    'problema-instalacao', 
    'revisao-conteudo', 
    'desaprovado-cliente', 
    'outros',
    'created',
    'edited',
    'restored',
    'deleted',
    'installed'
  ));

-- 3. Criar índices para melhorar performance de consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_item_versions_user_email 
  ON public.item_versions(user_email);

CREATE INDEX IF NOT EXISTS idx_item_versions_action_type 
  ON public.item_versions(action_type);

CREATE INDEX IF NOT EXISTS idx_item_versions_created_at 
  ON public.item_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_versions_installation_created 
  ON public.item_versions(installation_id, created_at DESC);

-- 4. Criar função para registrar automaticamente revisões
CREATE OR REPLACE FUNCTION public.auto_record_installation_revision()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_action_type TEXT;
  v_changes_summary JSONB;
  v_motivo TEXT;
  v_snapshot JSONB;
BEGIN
  -- Determinar o email do usuário (pode vir de auth.uid() ou do NEW.user_id)
  SELECT email INTO v_user_email 
  FROM auth.users 
  WHERE id = COALESCE(NEW.user_id, auth.uid());

  -- Determinar o tipo de ação
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'created';
    v_motivo := 'created';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'deleted';
    v_motivo := 'deleted';
  ELSIF NEW.installed = true AND (OLD.installed IS NULL OR OLD.installed = false) THEN
    v_action_type := 'installed';
    v_motivo := 'installed';
  ELSE
    v_action_type := 'updated';
    v_motivo := 'edited';
  END IF;

  -- Construir snapshot dos dados
  IF TG_OP = 'DELETE' THEN
    v_snapshot := row_to_json(OLD)::JSONB;
  ELSE
    v_snapshot := row_to_json(NEW)::JSONB;
  END IF;

  -- Calcular resumo das mudanças (apenas para UPDATE)
  IF TG_OP = 'UPDATE' THEN
    v_changes_summary := jsonb_build_object();
    
    -- Comparar campos relevantes
    IF NEW.tipologia IS DISTINCT FROM OLD.tipologia THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'tipologia', jsonb_build_object('before', OLD.tipologia, 'after', NEW.tipologia)
      );
    END IF;
    
    IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'codigo', jsonb_build_object('before', OLD.codigo, 'after', NEW.codigo)
      );
    END IF;
    
    IF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'descricao', jsonb_build_object('before', OLD.descricao, 'after', NEW.descricao)
      );
    END IF;
    
    IF NEW.quantidade IS DISTINCT FROM OLD.quantidade THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'quantidade', jsonb_build_object('before', OLD.quantidade, 'after', NEW.quantidade)
      );
    END IF;
    
    IF NEW.pavimento IS DISTINCT FROM OLD.pavimento THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'pavimento', jsonb_build_object('before', OLD.pavimento, 'after', NEW.pavimento)
      );
    END IF;
    
    IF NEW.installed IS DISTINCT FROM OLD.installed THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'installed', jsonb_build_object('before', OLD.installed, 'after', NEW.installed)
      );
    END IF;
    
    IF NEW.observacoes IS DISTINCT FROM OLD.observacoes THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'observacoes', jsonb_build_object('before', OLD.observacoes, 'after', NEW.observacoes)
      );
    END IF;

    IF NEW.photos IS DISTINCT FROM OLD.photos THEN
      v_changes_summary := v_changes_summary || jsonb_build_object(
        'photos', jsonb_build_object(
          'before', COALESCE(array_length(OLD.photos, 1), 0), 
          'after', COALESCE(array_length(NEW.photos, 1), 0)
        )
      );
    END IF;
  END IF;

  -- Inserir registro de revisão
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.item_versions (
      installation_id,
      snapshot,
      revisao,
      motivo,
      type,
      descricao_motivo,
      user_email,
      action_type,
      changes_summary,
      user_id
    ) VALUES (
      OLD.id,
      v_snapshot,
      COALESCE(OLD.revisao, 0) + 1,
      v_motivo,
      'deleted',
      'Instalação removida',
      v_user_email,
      v_action_type,
      jsonb_build_object('deleted', jsonb_build_object('before', false, 'after', true)),
      COALESCE(OLD.user_id, auth.uid())
    );
  ELSE
    -- Apenas registrar se houver mudanças significativas ou for INSERT
    IF TG_OP = 'INSERT' OR (v_changes_summary IS NOT NULL AND v_changes_summary != '{}'::jsonb) THEN
      INSERT INTO public.item_versions (
        installation_id,
        snapshot,
        revisao,
        motivo,
        type,
        descricao_motivo,
        user_email,
        action_type,
        changes_summary,
        user_id
      ) VALUES (
        NEW.id,
        v_snapshot,
        COALESCE(NEW.revisao, 0),
        v_motivo,
        CASE 
          WHEN v_action_type = 'created' THEN 'created'
          WHEN v_action_type = 'installed' THEN 'installed'
          WHEN v_action_type = 'deleted' THEN 'deleted'
          ELSE 'edited'
        END,
        CASE 
          WHEN v_action_type = 'created' THEN 'Versão inicial registrada automaticamente'
          WHEN v_action_type = 'installed' THEN 'Instalação marcada como concluída'
          ELSE 'Alterações registradas automaticamente'
        END,
        v_user_email,
        v_action_type,
        v_changes_summary,
        COALESCE(NEW.user_id, auth.uid())
      );
    END IF;
  END IF;

  -- Retornar o registro apropriado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar trigger para registrar automaticamente todas as alterações em installations
DROP TRIGGER IF EXISTS trigger_auto_record_installation_revision ON public.installations;

CREATE TRIGGER trigger_auto_record_installation_revision
  AFTER INSERT OR UPDATE OR DELETE ON public.installations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_record_installation_revision();

-- 6. Criar comentários para documentação
COMMENT ON COLUMN public.item_versions.user_email IS 'Email do usuário que fez a alteração';
COMMENT ON COLUMN public.item_versions.action_type IS 'Tipo de ação: created, updated, deleted, installed';
COMMENT ON COLUMN public.item_versions.changes_summary IS 'JSON com resumo das alterações (campo: {before: X, after: Y})';
COMMENT ON COLUMN public.item_versions.type IS 'Tipo de revisão: created, edited, restored, deleted, installed';

-- 7. Atualizar registros existentes (migração de dados)
UPDATE public.item_versions 
SET 
  action_type = CASE 
    WHEN motivo = 'created' THEN 'created'
    WHEN motivo = 'installed' THEN 'installed'
    WHEN motivo = 'deleted' THEN 'deleted'
    ELSE 'updated'
  END,
  type = CASE 
    WHEN motivo = 'created' THEN 'created'
    WHEN motivo = 'restored' THEN 'restored'
    WHEN motivo = 'deleted' THEN 'deleted'
    WHEN motivo = 'installed' THEN 'installed'
    ELSE 'edited'
  END
WHERE action_type IS NULL OR type IS NULL;

-- 8. Criar view para facilitar consultas de auditoria
CREATE OR REPLACE VIEW public.audit_trail AS
SELECT 
  iv.id,
  iv.installation_id,
  i.codigo as installation_code,
  i.descricao as installation_description,
  i.project_id,
  p.name as project_name,
  iv.revisao,
  iv.action_type,
  iv.motivo,
  iv.descricao_motivo,
  iv.user_email,
  u.email as user_email_verified,
  iv.changes_summary,
  iv.created_at,
  iv.updated_at
FROM public.item_versions iv
LEFT JOIN public.installations i ON iv.installation_id = i.id
LEFT JOIN public.projects p ON i.project_id = p.id
LEFT JOIN auth.users u ON iv.user_id = u.id
ORDER BY iv.created_at DESC;

-- 9. Criar política RLS para a view
ALTER VIEW public.audit_trail SET (security_invoker = true);

-- Conceder permissões
GRANT SELECT ON public.audit_trail TO authenticated;
GRANT SELECT ON public.audit_trail TO service_role;

-- 10. Criar índice GIN para buscas eficientes no changes_summary
CREATE INDEX IF NOT EXISTS idx_item_versions_changes_summary_gin 
  ON public.item_versions USING GIN (changes_summary);
