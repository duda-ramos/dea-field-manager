/**
 * Exemplo de uso do script de migração de fotos
 * 
 * Este arquivo demonstra como usar o script de migração
 * em diferentes contextos da aplicação.
 */

import { 
  migrateInstallationPhotosForProject,
  migrateAllProjects,
  fixPhotoMetadata 
} from './migrateInstallationPhotos';

/**
 * EXEMPLO 1: Migrar fotos de um projeto específico
 */
export async function exampleMigrateOneProject() {
  const projectId = 'seu-project-id-aqui';
  
  console.log('Iniciando migração do projeto...');
  
  const stats = await migrateInstallationPhotosForProject(projectId);
  
  // Verificar resultados
  if (stats.errors.length === 0) {
    console.log('✅ Migração concluída com sucesso!');
    console.log(`   - ${stats.photosSynced} fotos sincronizadas`);
    console.log(`   - ${stats.metadataFixed} metadados corrigidos`);
  } else {
    console.warn(`⚠️ Migração concluída com ${stats.errors.length} erros`);
    stats.errors.forEach(err => {
      console.error(`   - Instalação ${err.installationCode}: ${err.error}`);
    });
  }
  
  return stats;
}

/**
 * EXEMPLO 2: Migrar todos os projetos
 */
export async function exampleMigrateAllProjects() {
  console.log('Iniciando migração global...');
  
  const results = await migrateAllProjects();
  
  // Processar resultados
  let totalSuccess = 0;
  let totalErrors = 0;
  
  results.forEach((stats, projectId) => {
    if (stats.errors.length === 0) {
      totalSuccess++;
    } else {
      totalErrors += stats.errors.length;
    }
  });
  
  console.log(`\n📊 Resumo da migração global:`);
  console.log(`   - Projetos processados: ${results.size}`);
  console.log(`   - Projetos sem erros: ${totalSuccess}`);
  console.log(`   - Total de erros: ${totalErrors}`);
  
  return results;
}

/**
 * EXEMPLO 3: Corrigir metadados de uma foto específica
 */
export async function exampleFixSinglePhoto() {
  const projectId = 'seu-project-id-aqui';
  const fileId = 'img_1234567890_abc123';
  const storagePath = 'project-id/installation-id/photo.jpg';

  console.log('Corrigindo metadados da foto...');

  const fixed = await fixPhotoMetadata(projectId, fileId, storagePath);
  
  if (fixed) {
    console.log('✅ Metadados corrigidos com sucesso!');
  } else {
    console.log('ℹ️ Metadados já estavam corretos ou não foi possível corrigir');
  }
  
  return fixed;
}

/**
 * EXEMPLO 4: Usar em um componente React (com hook)
 */
export function usePhotoMigration() {
  const migrateProject = async (projectId: string) => {
    try {
      const stats = await migrateInstallationPhotosForProject(projectId);
      return { success: true, stats };
    } catch (error) {
      console.error('Erro na migração:', error);
      return { success: false, error };
    }
  };
  
  return { migrateProject };
}

/**
 * EXEMPLO 5: Executar migração com retry em caso de erro
 */
export async function exampleMigrateWithRetry(projectId: string, maxRetries = 3) {
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < maxRetries) {
    try {
      console.log(`Tentativa ${attempt + 1}/${maxRetries}...`);
      const stats = await migrateInstallationPhotosForProject(projectId);
      
      if (stats.errors.length === 0) {
        console.log('✅ Migração bem-sucedida!');
        return stats;
      }
      
      // Se houve erros mas não falhou completamente
      if (stats.photosSynced > 0 || stats.metadataFixed > 0) {
        console.log('⚠️ Migração parcial concluída');
        return stats;
      }
      
      throw new Error(`Migração falhou com ${stats.errors.length} erros`);
    } catch (error) {
      lastError = error as Error;
      attempt++;
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Migração falhou após todas as tentativas');
}

/**
 * EXEMPLO 6: Migração com callback de progresso
 */
export async function exampleMigrateWithProgress(
  projectId: string,
  onProgress?: (current: number, total: number, message: string) => void
) {
  console.log('Iniciando migração com progresso...');
  
  // Esta é uma versão simplificada - para progresso real,
  // seria necessário modificar a função principal
  const stats = await migrateInstallationPhotosForProject(projectId);
  
  // Simular callbacks de progresso
  if (onProgress) {
    onProgress(stats.photosSynced, stats.totalPhotos, 'Fotos sincronizadas');
    onProgress(stats.metadataFixed, stats.totalPhotos, 'Metadados corrigidos');
    onProgress(stats.totalPhotos, stats.totalPhotos, 'Concluído!');
  }
  
  return stats;
}

// Exportar funções para uso no console do navegador (DEV only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).photoMigrationExamples = {
    migrateOne: exampleMigrateOneProject,
    migrateAll: exampleMigrateAllProjects,
    fixOne: exampleFixSinglePhoto,
    migrateWithRetry: exampleMigrateWithRetry,
    migrateWithProgress: exampleMigrateWithProgress
  };
  
  console.log('📝 Exemplos de migração de fotos carregados!');
  console.log('Use no console: photoMigrationExamples.migrateOne()');
}
