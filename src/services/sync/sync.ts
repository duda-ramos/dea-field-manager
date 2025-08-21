import { supabase } from '@/integrations/supabase/client';
import { db } from '@/db/indexedDb';
import { getLastPulledAt, setLastPulledAt, setSyncStatus } from './localFlags';
import type { Project, Installation, ProjectContact, ProjectBudget, ItemVersion, ProjectFile } from '@/types';

// Timestamp normalization helpers
const normalizeTimestamps = (obj: any) => ({
  ...obj,
  created_at: obj.createdAt || obj.created_at,
  updated_at: obj.updatedAt || obj.updated_at
});

const denormalizeTimestamps = (obj: any) => ({
  ...obj,
  createdAt: obj.created_at,
  updatedAt: obj.updated_at ? new Date(obj.updated_at).getTime() : Date.now()
});

// Push local changes to Supabase
export async function syncPush(): Promise<void> {
  console.log('Starting push sync...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Push projects
  const dirtyProjects = await db.projects.where('_dirty').equals(1).toArray();
  for (const project of dirtyProjects) {
    try {
      if (project._deleted) {
        await supabase.from('projects').delete().eq('id', project.id);
      } else {
        const normalizedProject = normalizeTimestamps({
          ...project,
          user_id: user.id,
          owner_name: project.owner,
          suppliers: project.suppliers || []
        });
        delete normalizedProject._dirty;
        delete normalizedProject._deleted;
        delete normalizedProject.owner;
        delete normalizedProject.updatedAt;
        delete normalizedProject.createdAt;
        
        await supabase.from('projects').upsert(normalizedProject);
      }
      
      // Clear dirty flag
      if (project._deleted) {
        await db.projects.delete(project.id);
      } else {
        await db.projects.update(project.id, { _dirty: 0 });
      }
    } catch (error) {
      console.error('Error pushing project:', project.id, error);
    }
  }

  // Push installations
  const dirtyInstallations = await db.installations.where('_dirty').equals(1).toArray();
  for (const installation of dirtyInstallations) {
    try {
      if (installation._deleted) {
        await supabase.from('installations').delete().eq('id', installation.id);
      } else {
        const normalizedInstallation = normalizeTimestamps({
          ...installation,
          user_id: user.id,
          photos: installation.photos || []
        });
        delete normalizedInstallation._dirty;
        delete normalizedInstallation._deleted;
        delete normalizedInstallation.updatedAt;
        delete normalizedInstallation.createdAt;
        
        await supabase.from('installations').upsert(normalizedInstallation);
      }
      
      if (installation._deleted) {
        await db.installations.delete(installation.id);
      } else {
        await db.installations.update(installation.id, { _dirty: 0 });
      }
    } catch (error) {
      console.error('Error pushing installation:', installation.id, error);
    }
  }

  // Push contacts
  const dirtyContacts = await db.contacts.where('_dirty').equals(1).toArray();
  for (const contact of dirtyContacts) {
    try {
      if (contact._deleted) {
        await supabase.from('contacts').delete().eq('id', contact.id);
      } else {
        const normalizedContact = normalizeTimestamps({
          id: contact.id,
          project_id: contact.projetoId,
          name: contact.nome,
          role: contact.tipo,
          phone: contact.telefone,
          email: contact.email,
          user_id: user.id
        });
        delete normalizedContact._dirty;
        delete normalizedContact._deleted;
        
        await supabase.from('contacts').upsert(normalizedContact);
      }
      
      if (contact._deleted) {
        await db.contacts.delete(contact.id);
      } else {
        await db.contacts.update(contact.id, { _dirty: 0 });
      }
    } catch (error) {
      console.error('Error pushing contact:', contact.id, error);
    }
  }

  // Push budgets  
  const dirtyBudgets = await db.budgets.where('_dirty').equals(1).toArray();
  for (const budget of dirtyBudgets) {
    try {
      if (budget._deleted) {
        await supabase.from('budgets').delete().eq('id', budget.id);
      } else {
        const normalizedBudget = normalizeTimestamps({
          ...budget,
          user_id: user.id,
          project_id: budget.projectId
        });
        delete normalizedBudget._dirty;
        delete normalizedBudget._deleted;
        delete normalizedBudget.projectId;
        delete normalizedBudget.updatedAt;
        delete normalizedBudget.createdAt;
        
        await supabase.from('budgets').upsert(normalizedBudget);
      }
      
      if (budget._deleted) {
        await db.budgets.delete(budget.id);
      } else {
        await db.budgets.update(budget.id, { _dirty: 0 });
      }
    } catch (error) {
      console.error('Error pushing budget:', budget.id, error);
    }
  }

  // Push item versions
  const dirtyItemVersions = await db.itemVersions.where('_dirty').equals(1).toArray();
  for (const itemVersion of dirtyItemVersions) {
    try {
      if (itemVersion._deleted) {
        await supabase.from('item_versions').delete().eq('id', itemVersion.id);
      } else {
        const normalizedItemVersion = normalizeTimestamps({
          id: itemVersion.id,
          installation_id: itemVersion.itemId,
          snapshot: itemVersion.snapshot,
          revisao: itemVersion.revisao,
          motivo: itemVersion.motivo,
          descricao_motivo: itemVersion.descricao_motivo,
          user_id: user.id
        });
        delete normalizedItemVersion._dirty;
        delete normalizedItemVersion._deleted;
        delete normalizedItemVersion.updatedAt;
        delete normalizedItemVersion.createdAt;
        
        await supabase.from('item_versions').upsert(normalizedItemVersion);
      }
      
      if (itemVersion._deleted) {
        await db.itemVersions.delete(itemVersion.id);
      } else {
        await db.itemVersions.update(itemVersion.id, { _dirty: 0 });
      }
    } catch (error) {
      console.error('Error pushing item version:', itemVersion.id, error);
    }
  }

  // Push files
  const dirtyFiles = await db.files.where('_dirty').equals(1).toArray();
  for (const file of dirtyFiles) {
    try {
      if (file._deleted) {
        await supabase.from('files').delete().eq('id', file.id);
      } else {
        const normalizedFile = normalizeTimestamps({
          ...file,
          user_id: user.id,
          project_id: file.projectId,
          installation_id: file.installationId
        });
        delete normalizedFile._dirty;
        delete normalizedFile._deleted;
        delete normalizedFile.projectId;
        delete normalizedFile.installationId;
        delete normalizedFile.updatedAt;
        delete normalizedFile.createdAt;
        
        await supabase.from('files').upsert(normalizedFile);
      }
      
      if (file._deleted) {
        await db.files.delete(file.id);
      } else {
        await db.files.update(file.id, { _dirty: 0 });
      }
    } catch (error) {
      console.error('Error pushing file:', file.id, error);
    }
  }

  console.log('Push sync completed');
}

// Pull changes from Supabase
export async function syncPull(): Promise<void> {
  console.log('Starting pull sync...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const lastPulledAt = await getLastPulledAt();
  const lastPulledDate = new Date(lastPulledAt).toISOString();

  // Pull projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .gt('updated_at', lastPulledDate)
    .eq('user_id', user.id);

  if (projects) {
    for (const project of projects) {
      const localProject = denormalizeTimestamps({
        ...project,
        owner: project.owner_name,
        _dirty: 0,
        _deleted: 0
      });
      delete localProject.owner_name;
      delete localProject.user_id;
      
      await db.projects.put(localProject);
    }
  }

  // Pull installations
  const { data: installations } = await supabase
    .from('installations')
    .select('*')
    .gt('updated_at', lastPulledDate)
    .eq('user_id', user.id);

  if (installations) {
    for (const installation of installations) {
      const localInstallation = denormalizeTimestamps({
        ...installation,
        _dirty: 0,
        _deleted: 0
      });
      delete localInstallation.user_id;
      
      await db.installations.put(localInstallation);
    }
  }

  // Pull contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gt('updated_at', lastPulledDate)
    .eq('user_id', user.id);

  if (contacts) {
    for (const contact of contacts) {
      const localContact = denormalizeTimestamps({
        id: contact.id,
        projetoId: contact.project_id,
        nome: contact.name,
        tipo: contact.role,
        telefone: contact.phone,
        email: contact.email,
        atualizadoEm: contact.updated_at,
        _dirty: 0,
        _deleted: 0
      });
      
      await db.contacts.put(localContact);
    }
  }

  // Pull budgets
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .gt('updated_at', lastPulledDate)
    .eq('user_id', user.id);

  if (budgets) {
    for (const budget of budgets) {
      const localBudget = denormalizeTimestamps({
        ...budget,
        projectId: budget.project_id,
        _dirty: 0,
        _deleted: 0
      });
      delete localBudget.project_id;
      delete localBudget.user_id;
      
      await db.budgets.put(localBudget);
    }
  }

  // Pull item versions
  const { data: itemVersions } = await supabase
    .from('item_versions')
    .select('*')
    .gt('updated_at', lastPulledDate)
    .eq('user_id', user.id);

  if (itemVersions) {
    for (const itemVersion of itemVersions) {
      const localItemVersion = denormalizeTimestamps({
        id: itemVersion.id,
        itemId: itemVersion.installation_id,
        snapshot: itemVersion.snapshot,
        revisao: itemVersion.revisao,
        motivo: itemVersion.motivo,
        descricao_motivo: itemVersion.descricao_motivo,
        criadoEm: itemVersion.created_at,
        _dirty: 0,
        _deleted: 0
      });
      
      await db.itemVersions.put(localItemVersion);
    }
  }

  // Pull files
  const { data: files } = await supabase
    .from('files')
    .select('*')
    .gt('updated_at', lastPulledDate)
    .eq('user_id', user.id);

  if (files) {
    for (const file of files) {
      const localFile = denormalizeTimestamps({
        ...file,
        projectId: file.project_id,
        installationId: file.installation_id,
        uploaded_at: file.created_at,
        _dirty: 0,
        _deleted: 0
      });
      delete localFile.project_id;
      delete localFile.installation_id;
      delete localFile.user_id;
      
      await db.files.put(localFile);
    }
  }

  // Update last pulled timestamp
  await setLastPulledAt(Date.now());
  console.log('Pull sync completed');
}

// Full sync operation
export async function fullSync(): Promise<void> {
  await setSyncStatus('syncing');
  
  try {
    await syncPush();
    await syncPull();
    console.log('Full sync completed successfully');
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  } finally {
    await setSyncStatus('idle');
  }
}