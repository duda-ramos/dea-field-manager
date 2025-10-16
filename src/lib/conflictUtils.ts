import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/services/logger';

/**
 * Informações sobre um potencial conflito de edição
 * Usado para rastrear e comparar versões local e remota
 */
export interface EditConflictInfo {
  recordId: string;
  recordType: 'project' | 'installation' | 'contact' | 'budget';
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  hasConflict: boolean;
}

/**
 * Detalhes completos de um conflito detectado
 * Inclui ambas as versões para comparação e resolução
 */
export interface ConflictDetails {
  recordType: string;
  recordName: string;
  localVersion: Record<string, unknown>;
  remoteVersion: Record<string, unknown>;
}

/**
 * Verifica se há conflitos de edição entre versões local e remota
 * 
 * Detecta conflitos quando:
 * 1. O registro local foi modificado (_dirty === 1)
 * 2. A versão remota é mais recente que a local
 * 3. A diferença temporal é significativa (> 1 minuto)
 * 
 * O limite de 1 minuto evita falsos positivos em sincronizações rápidas
 * 
 * @param localRecord - Registro da base local com flag _dirty
 * @param remoteRecord - Registro vindo do servidor
 * @param recordId - ID único do registro
 * @param recordType - Tipo do registro para categorização
 * @returns Objeto com informações sobre o conflito
 */
export function checkForRemoteEdits(
  localRecord: { updated_at: string; _dirty?: number },
  remoteRecord: { updated_at: string },
  recordId: string,
  recordType: 'project' | 'installation' | 'contact' | 'budget'
): EditConflictInfo {
  const localDate = new Date(localRecord.updated_at);
  const remoteDate = new Date(remoteRecord.updated_at);
  
  // Há conflito se:
  // 1. Registro local foi modificado (_dirty === 1)
  // 2. Versão remota é mais recente que a local
  // 3. Diferença é maior que 1 minuto (para evitar falsos positivos)
  const hasConflict = 
    localRecord._dirty === 1 &&
    remoteDate > localDate &&
    (remoteDate.getTime() - localDate.getTime()) > 60000; // 1 minuto

  return {
    recordId,
    recordType,
    localUpdatedAt: localRecord.updated_at,
    remoteUpdatedAt: remoteRecord.updated_at,
    hasConflict
  };
}

/**
 * Obtém preview dos campos principais de um registro
 * 
 * Gera um resumo formatado dos campos mais importantes de cada tipo
 * Usado para exibir comparações no modal de resolução de conflitos
 * 
 * @param recordType - Tipo do registro
 * @param record - Objeto do registro com os dados
 * @returns Objeto com pares chave-valor formatados para exibição
 */
export function getRecordPreview(recordType: string, record: Record<string, unknown>): Record<string, string> {
  switch (recordType) {
    case 'installation':
      return {
        'Código': record.codigo || '—',
        'Descrição': record.descricao || '—',
        'Quantidade': record.quantidade?.toString() || '—',
        'Status': record.installed ? 'Instalado' : 'Pendente'
      };
    
    case 'project':
      return {
        'Nome': record.name || '—',
        'Cliente': record.client || '—',
        'Status': record.status || '—',
        'Cidade': record.city || '—'
      };
    
    case 'contact':
      return {
        'Nome': record.name || '—',
        'Função': record.role || '—',
        'Telefone': record.phone || '—',
        'Email': record.email || '—'
      };
    
    case 'budget':
      return {
        'Fornecedor': record.supplier || '—',
        'Status': record.status || '—',
        'Arquivo': record.fileName || '—'
      };
    
    default:
      return {};
  }
}

/**
 * Obtém nome descritivo do registro para exibição
 * 
 * Gera um nome amigável baseado no tipo e conteúdo do registro
 * Usado em notificações e títulos de conflitos
 * 
 * @param recordType - Tipo do registro
 * @param record - Objeto do registro
 * @returns String descritiva do registro
 */
export function getRecordDisplayName(recordType: string, record: Record<string, unknown>): string {
  switch (recordType) {
    case 'installation':
      return `Instalação ${record.codigo || 'sem código'}`;
    
    case 'project':
      return record.name || 'Projeto sem nome';
    
    case 'contact':
      return record.name || 'Contato sem nome';
    
    case 'budget':
      return `Orçamento de ${record.supplier || 'fornecedor'}`;
    
    default:
      return 'Registro';
  }
}

/**
 * Formata data para exibição amigável em português
 * 
 * Converte ISO string para formato legível: "15 de janeiro às 14:30"
 * Trata erros graciosamente retornando mensagem padrão
 * 
 * @param dateString - Data em formato ISO string
 * @returns Data formatada ou "Data inválida" em caso de erro
 */
export function formatConflictDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
}

/**
 * Marca registro para upload forçado (ignora verificações de timestamp)
 * 
 * Usado quando o usuário escolhe manter sua versão local em um conflito
 * - Define flag _forceUpload para bypass de verificações
 * - Marca como dirty para garantir sincronização
 * - Atualiza timestamp para forçar precedência
 * 
 * @param record - Registro a ser marcado
 * @returns Novo objeto com flags de força aplicadas
 */
export function markForForceUpload(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    _forceUpload: 1,
    _dirty: 1,
    updated_at: new Date().toISOString()
  };
}

/**
 * Remove flags de sincronização do registro
 * 
 * Limpa metadados internos antes de salvar versão remota localmente
 * Remove _dirty e _forceUpload para evitar sincronizações desnecessárias
 * 
 * @param record - Registro com possíveis flags de sync
 * @returns Registro limpo sem metadados internos
 */
export function cleanSyncFlags(record: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...record };
  delete cleaned._dirty;
  delete cleaned._forceUpload;
  return cleaned;
}

/**
 * Log estruturado para conflitos com prefixo consistente
 * 
 * Centraliza logs relacionados a conflitos para facilitar debug
 * Usa níveis apropriados: warn para detecção, log para resolução
 * 
 * @param action - Tipo de ação: 'detected' ou 'resolved'
 * @param details - Objeto com detalhes do conflito/resolução
 */
export function logConflict(action: 'detected' | 'resolved', details: Record<string, unknown>): void {
  if (action === 'detected') {
    logger.warn('[Conflict] Edit conflict detected', details);
  } else {
    logger.info('[Conflict] Resolved', details);
  }
}