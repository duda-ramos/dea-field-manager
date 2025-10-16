import { db } from '@/db/indexedDb';

const MIGRATION_FLAG = 'dfm:indexeddb:migrated:v1';

/**
 * Utilitários
 */
function safeParse<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function asArray(v: unknown): unknown[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object' && 'items' in v && Array.isArray(v.items)) return v.items; // alguns saves legados usam { items: [...] }
  return [];
}

type LegacyPayload = {
  projects: unknown[];
  installations: unknown[];
  contacts: unknown[];
  budgets: unknown[];
  itemVersions: unknown[]; // enriched com installationId quando vier de versions_<installationId>
  files: unknown[]; // enriched com projectId quando vier de project_files_<projectId>
};

/**
 * Varre o localStorage e consolida os dados legados em arrays normalizados
 */
function collectLegacyDataFromLocalStorage(): LegacyPayload {
  const out: LegacyPayload = {
    projects: [],
    installations: [],
    contacts: [],
    budgets: [],
    itemVersions: [],
    files: [],
  };

  // padrões detectados no projeto
  const reVersions = /^versions_(.+)$/; // versions_<installationId>
  const reProjectFiles = /^project_files_(.+)$/; // project_files_<projectId>

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    const raw = localStorage.getItem(key);

    // 1) Blocos agregados "dea_manager_*"
    if (key === 'dea_manager_projects') {
      out.projects.push(...asArray(safeParse(raw)));
      continue;
    }
    if (key === 'dea_manager_installations') {
      out.installations.push(...asArray(safeParse(raw)));
      continue;
    }
    if (key === 'dea_manager_contacts') {
      out.contacts.push(...asArray(safeParse(raw)));
      continue;
    }
    if (key === 'dea_manager_budgets') {
      out.budgets.push(...asArray(safeParse(raw)));
      continue;
    }
    if (key === 'dea_manager_reports') {
      // se houver dados de relatórios agregados; normalmente exportáveis
      // não temos tabela "reports" no Dexie; ignore ou mapeie se fizer sentido
      // Aqui vamos ignorar (relatórios podem ser re-gerados).
      continue;
    }

    // 2) Contatos por projeto (project_contacts)
    if (key === 'project_contacts') {
      // alguns apps salvam como objeto { [projectId]: Contact[] }
      // ou array simples de contatos. Suportamos os dois.
      const parsed = safeParse<Record<string, unknown>>(raw);
      if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
        for (const [projectId, contacts] of Object.entries(parsed)) {
          asArray(contacts).forEach((c: Record<string, unknown>) => {
            if (projectId && !c.projectId) c.projectId = projectId;
            out.contacts.push(c);
          });
        }
      } else {
        out.contacts.push(...asArray(parsed));
      }
      continue;
    }

    // 3) Versões por instalação: versions_<installationId>
    const mV = key.match(reVersions);
    if (mV) {
      const installationId = mV[1];
      const versions = asArray(safeParse(raw));
      versions.forEach((v: Record<string, unknown>) => {
        if (installationId && !v.installationId) v.installationId = installationId;
        out.itemVersions.push(v);
      });
      continue;
    }

    // 4) Arquivos por projeto: project_files_<projectId>
    const mF = key.match(reProjectFiles);
    if (mF) {
      const projectId = mF[1];
      const files = asArray(safeParse(raw));
      files.forEach((f: Record<string, unknown>) => {
        if (projectId && !f.projectId) f.projectId = projectId;
        out.files.push(f);
      });
      continue;
    }

    // Outros casos legados podem ser adicionados aqui conforme necessário
  }

  return out;
}

/**
 * Migração principal
 */
export async function migrateLocalToIndexedIfNeeded() {
  if (typeof window === 'undefined') return;
  if (!('indexedDB' in window)) return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const legacy = collectLegacyDataFromLocalStorage();

  // Deduplique por id quando possível (se itens vierem repetidos de chaves diferentes)
  const byId = <T extends { id?: string }>(arr: T[]) => {
    const map = new Map<string, T>();
    const out: T[] = [];
    for (const item of arr) {
      if (item && typeof item === 'object' && item.id) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        } else {
          // merge superficial preservando campos já existentes
          map.set(item.id, { ...item, ...map.get(item.id)! });
        }
      } else {
        out.push(item); // sem id, não dá pra deduplicar de forma segura
      }
    }
    return [...map.values(), ...out];
  };

  const projects = byId(legacy.projects);
  const installations = byId(legacy.installations);
  const contacts = byId(legacy.contacts);
  const budgets = byId(legacy.budgets);
  const itemVersions = byId(legacy.itemVersions);
  const files = byId(legacy.files);

  // Escrita transacional no Dexie
  await db.transaction(
    'rw',
    [db.projects, db.installations, db.contacts, db.budgets, db.itemVersions, db.files],
    async () => {
      if (projects.length) await db.projects.bulkPut(projects);
      if (installations.length) await db.installations.bulkPut(installations);
      if (contacts.length) await db.contacts.bulkPut(contacts);
      if (budgets.length) await db.budgets.bulkPut(budgets);
      if (itemVersions.length) await db.itemVersions.bulkPut(itemVersions);
      if (files.length) await db.files.bulkPut(files);
    },
  );

  localStorage.setItem(MIGRATION_FLAG, '1');
}

