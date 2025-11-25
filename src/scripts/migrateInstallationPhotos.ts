import { supabase } from '@/integrations/supabase/client';
import { StorageManagerDexie } from '@/services/StorageManager';
import { syncPhotoToProjectAlbum } from '@/utils/photoSync';
import type { ProjectFile } from '@/types';

const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string;

interface MigrationStats {
  totalInstallations: number;
  totalPhotos: number;
  photosSynced: number;
  metadataFixed: number;
  errors: Array<{ installationCode: string; photoPath: string; error: string }>;
}

/**
 * Busca metadados reais de um arquivo no Supabase Storage
 */
async function getStorageFileMetadata(storagePath: string): Promise<{ size: number; type: string } | null> {
  try {
    if (!bucket) {
      throw new Error('Supabase storage bucket not configured');
    }

    // Método 1: Tentar fazer download do arquivo para obter metadados
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError) {
      console.warn('Não foi possível baixar arquivo, tentando método alternativo:', downloadError.message);
      
      // Método 2: Usar a API list para obter metadados
      const pathParts = storagePath.split('/');
      const fileName = pathParts.pop();
      const folderPath = pathParts.join('/');
      
      const { data: listData, error: listError } = await supabase.storage
        .from(bucket)
        .list(folderPath, {
          search: fileName
        });

      if (listError || !listData || listData.length === 0) {
        console.error('Arquivo não encontrado no storage:', storagePath);
        return null;
      }

      const fileMetadata = listData[0];
      return {
        size: fileMetadata.metadata?.size || 0,
        type: fileMetadata.metadata?.mimetype || 'image/jpeg'
      };
    }

    // Se conseguiu fazer download, usar dados do blob
    if (fileData) {
      return {
        size: fileData.size,
        type: fileData.type || 'image/jpeg'
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao obter metadados do storage:', error);
    return null;
  }
}

/**
 * Corrige metadados de uma foto existente na galeria
 * Busca tamanho e tipo reais do arquivo no storage
 */
export async function fixPhotoMetadata(
  projectId: string,
  fileId: string,
  storagePath: string
): Promise<boolean> {
  try {
    console.log(`🔧 Corrigindo metadados para: ${storagePath}`);

    // Buscar metadados reais do arquivo no storage
    const metadata = await getStorageFileMetadata(storagePath);
    
    if (!metadata) {
      console.warn('⚠️ Não foi possível obter metadados do storage');
      return false;
    }

    // Obter arquivo atual do banco limitado ao projeto
    const projectFiles = await StorageManagerDexie.getFilesByProject(projectId);
    const file = projectFiles.find(f => f.id === fileId);
    
    if (!file) {
      console.warn('⚠️ Arquivo não encontrado no banco:', fileId);
      return false;
    }

    // Verificar se precisa atualizar
    const needsUpdate = file.size === 0 || !file.type || file.type === 'image';

    if (needsUpdate) {
      // Atualizar com metadados corretos
      const updatedFile: ProjectFile = {
        ...file,
        size: metadata.size,
        type: metadata.type,
        url: file.url || '', // Manter url existente ou vazio
        updatedAt: Date.now()
      };

      await StorageManagerDexie.upsertFile(updatedFile);
      console.log(`✅ Metadados corrigidos: ${metadata.size} bytes, tipo: ${metadata.type}`);
      return true;
    }

    console.log('ℹ️ Metadados já estão corretos');
    return false;
  } catch (error) {
    console.error('❌ Erro ao corrigir metadados:', error);
    return false;
  }
}

/**
 * Verifica se uma foto já existe no álbum do projeto
 */
async function photoExistsInGallery(
  projectId: string,
  storagePath: string
): Promise<ProjectFile | null> {
  try {
    const files = await StorageManagerDexie.getFilesByProject(projectId);
    return files.find(f => f.storagePath === storagePath) || null;
  } catch (error) {
    console.error('Erro ao verificar foto na galeria:', error);
    return null;
  }
}

/**
 * Migra fotos de instalações para o álbum do projeto
 * Sincroniza novas fotos E corrige metadados de fotos existentes
 */
export async function migrateInstallationPhotosForProject(
  projectId: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalInstallations: 0,
    totalPhotos: 0,
    photosSynced: 0,
    metadataFixed: 0,
    errors: []
  };

  try {
    console.log(`\n🚀 Iniciando migração de fotos para projeto: ${projectId}\n`);

    // Buscar todas as instalações do projeto
    const installations = await StorageManagerDexie.getInstallationsByProject(projectId);
    stats.totalInstallations = installations.length;

    console.log(`📊 Total de instalações: ${installations.length}`);

    // Processar cada instalação
    for (const installation of installations) {
      if (!installation.photos || installation.photos.length === 0) {
        continue;
      }

      console.log(`\n📦 Processando instalação ${installation.codigo} (${installation.descricao})`);
      console.log(`   Fotos encontradas: ${installation.photos.length}`);

      stats.totalPhotos += installation.photos.length;

      // Processar cada foto da instalação
      for (const photoPath of installation.photos) {
        try {
          // 1. Verificar se a foto já existe na galeria
          const existingPhoto = await photoExistsInGallery(projectId, photoPath);

          if (!existingPhoto) {
            // 2a. Foto NÃO existe: Sincronizar nova foto
            console.log(`   ➕ Nova foto: ${photoPath}`);
            
            // Obter metadados do storage
            const metadata = await getStorageFileMetadata(photoPath);
            const fileSize = metadata?.size || 0;
            const fileType = metadata?.type || 'image/jpeg';

            await syncPhotoToProjectAlbum(
              projectId,
              installation.id,
              String(installation.codigo),
              photoPath,
              fileSize,
              fileType
            );

            stats.photosSynced++;
            console.log(`   ✅ Foto sincronizada`);
          } else {
            // 2b. Foto JÁ existe: Verificar e corrigir metadados se necessário
            console.log(`   🔍 Foto existente: ${existingPhoto.name}`);

            if (existingPhoto.size === 0 || !existingPhoto.type || existingPhoto.type === 'image') {
              console.log(`   🔧 Corrigindo metadados (size=${existingPhoto.size}, type=${existingPhoto.type})`);
              
              const fixed = await fixPhotoMetadata(projectId, existingPhoto.id, photoPath);
              if (fixed) {
                stats.metadataFixed++;
              }
            } else {
              console.log(`   ✓ Metadados OK (size=${existingPhoto.size}, type=${existingPhoto.type})`);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          stats.errors.push({
            installationCode: String(installation.codigo),
            photoPath,
            error: errorMessage
          });
          console.error(`   ❌ Erro ao processar foto ${photoPath}:`, errorMessage);
        }
      }
    }

    // Exibir estatísticas finais
    console.log('\n' + '='.repeat(60));
    console.log('📊 ESTATÍSTICAS DA MIGRAÇÃO');
    console.log('='.repeat(60));
    console.log(`Total de instalações processadas: ${stats.totalInstallations}`);
    console.log(`Total de fotos encontradas: ${stats.totalPhotos}`);
    console.log(`✅ Fotos sincronizadas (novas): ${stats.photosSynced}`);
    console.log(`🔧 Metadados corrigidos (existentes): ${stats.metadataFixed}`);
    console.log(`❌ Erros encontrados: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\n⚠️ ERROS DETALHADOS:');
      stats.errors.forEach((err, idx) => {
        console.log(`${idx + 1}. Instalação ${err.installationCode} - ${err.photoPath}`);
        console.log(`   Erro: ${err.error}`);
      });
    }
    
    console.log('='.repeat(60) + '\n');

    return stats;
  } catch (error) {
    console.error('❌ Erro fatal durante migração:', error);
    throw error;
  }
}

/**
 * Migra fotos de todos os projetos
 */
export async function migrateAllProjects(): Promise<Map<string, MigrationStats>> {
  const results = new Map<string, MigrationStats>();

  try {
    console.log('🌍 Iniciando migração global de fotos...\n');

    const projects = await StorageManagerDexie.getProjects();
    console.log(`📁 Total de projetos: ${projects.length}\n`);

    for (const project of projects) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Projeto: ${project.name} (${project.code})`);
      console.log('='.repeat(60));
      
      const stats = await migrateInstallationPhotosForProject(project.id);
      results.set(project.id, stats);
    }

    // Estatísticas globais
    let totalInstallations = 0;
    let totalPhotos = 0;
    let totalSynced = 0;
    let totalFixed = 0;
    let totalErrors = 0;

    results.forEach(stats => {
      totalInstallations += stats.totalInstallations;
      totalPhotos += stats.totalPhotos;
      totalSynced += stats.photosSynced;
      totalFixed += stats.metadataFixed;
      totalErrors += stats.errors.length;
    });

    console.log('\n' + '='.repeat(60));
    console.log('🌍 ESTATÍSTICAS GLOBAIS');
    console.log('='.repeat(60));
    console.log(`Projetos processados: ${projects.length}`);
    console.log(`Total de instalações: ${totalInstallations}`);
    console.log(`Total de fotos: ${totalPhotos}`);
    console.log(`✅ Fotos sincronizadas: ${totalSynced}`);
    console.log(`🔧 Metadados corrigidos: ${totalFixed}`);
    console.log(`❌ Total de erros: ${totalErrors}`);
    console.log('='.repeat(60) + '\n');

    return results;
  } catch (error) {
    console.error('❌ Erro fatal na migração global:', error);
    throw error;
  }
}

// Exportar para uso no console do navegador
if (typeof window !== 'undefined') {
  (window as any).migrateInstallationPhotos = {
    migrateProject: migrateInstallationPhotosForProject,
    migrateAll: migrateAllProjects,
    fixMetadata: fixPhotoMetadata
  };
  
  console.log('📸 Script de migração de fotos carregado!');
  console.log('Use no console:');
  console.log('  - migrateInstallationPhotos.migrateProject(projectId)');
  console.log('  - migrateInstallationPhotos.migrateAll()');
  console.log('  - migrateInstallationPhotos.fixMetadata(fileId, storagePath)');
}
