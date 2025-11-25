import { useState, useEffect, useRef } from 'react';
import { db } from '@/db/indexedDb';
import { Project } from '@/types';
import { logger } from '@/services/logger';

/**
 * Hook para escutar mudanças em tempo real na tabela de projetos
 * Atualiza automaticamente quando o RealtimeManager modifica o IndexedDB
 */
export function useRealtimeProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let isMounted = true;

    // Função para carregar projetos
    const loadProjects = async () => {
      try {
        const allProjects = await db.projects.toArray();
        if (isMounted) {
          setProjects(allProjects as Project[]);
          setError(null);
        }
      } catch (err) {
        logger.error('Error loading projects:', err);
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Função para verificar mudanças
    const checkForUpdates = async () => {
      try {
        const count = await db.projects.count();
        const lastProject = await db.projects.orderBy('updatedAt').last();
        const latestUpdate = lastProject?.updatedAt || 0;

        // Se houve mudanças desde a última verificação
        if (latestUpdate > lastUpdateRef.current || count !== projects.length) {
          lastUpdateRef.current = latestUpdate;
          await loadProjects();
        }
      } catch (err) {
        logger.error('Error checking for updates:', err);
      }
    };

    // Carregar projetos inicialmente
    loadProjects();

    // Configurar polling para detectar mudanças (a cada 2 segundos)
    intervalRef.current = setInterval(checkForUpdates, 2000);

    // Escutar evento customizado do realtime manager
    const handleRealtimeUpdate = (event: CustomEvent) => {
      if (event.detail?.table === 'projects') {
        loadProjects();
      }
    };

    window.addEventListener('realtime-update', handleRealtimeUpdate as EventListener);

    // Cleanup
    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('realtime-update', handleRealtimeUpdate as EventListener);
    };
  }, [projects.length]);

  return { 
    projects, 
    isLoading, 
    error, 
    refresh: async () => {
      setIsLoading(true);
      try {
        const allProjects = await db.projects.toArray();
        setProjects(allProjects as Project[]);
        setError(null);
        const lastProject = await db.projects.orderBy('updatedAt').last();
        lastUpdateRef.current = lastProject?.updatedAt || 0;
      } catch (err) {
        logger.error('Error refreshing projects:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }
  };
}
