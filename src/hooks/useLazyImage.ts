import { useEffect, useRef, useState } from 'react';

interface UseLazyImageOptions extends IntersectionObserverInit {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
}

interface UseLazyImageReturn {
  ref: React.RefObject<HTMLImageElement>;
  isLoaded: boolean;
  imageSrc: string;
}

// Placeholder SVG com gradiente suave
const DEFAULT_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Cdefs%3E%3ClinearGradient id="grad" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%23e0e0e0;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%23f5f5f5;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="400" height="300" fill="url(%23grad)" /%3E%3C/svg%3E';

/**
 * Hook customizado para lazy loading de imagens usando IntersectionObserver
 * 
 * @param imageUrl - URL da imagem a ser carregada
 * @param options - Opções do IntersectionObserver
 * @returns ref para o elemento img, estado de carregamento e src atual
 */
export function useLazyImage(
  imageUrl: string,
  options?: UseLazyImageOptions
): UseLazyImageReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(DEFAULT_PLACEHOLDER);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    // Reset state quando imageUrl mudar
    setIsLoaded(false);
    setImageSrc(DEFAULT_PLACEHOLDER);
    isLoadedRef.current = false;

    const imgElement = imgRef.current;
    if (!imgElement) return;

    // Opções padrão do IntersectionObserver
    const observerOptions: IntersectionObserverInit = {
      threshold: options?.threshold ?? 0.5, // 50% visível por padrão
      rootMargin: options?.rootMargin ?? '0px',
      root: options?.root ?? null,
    };

    // Função para carregar a imagem real
    const loadImage = () => {
      if (isLoadedRef.current) return; // Evita carregamentos múltiplos
      
      const img = new Image();
      
      img.onload = () => {
        // Imagem carregada com sucesso
        setImageSrc(imageUrl);
        setIsLoaded(true);
        isLoadedRef.current = true;
        
        // Remove observer após carregar
        if (observerRef.current && imgElement) {
          observerRef.current.unobserve(imgElement);
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      };

      img.onerror = () => {
        // Em caso de erro, também marca como carregado
        // para evitar tentativas infinitas
        setIsLoaded(true);
        isLoadedRef.current = true;
        
        // Remove observer
        if (observerRef.current && imgElement) {
          observerRef.current.unobserve(imgElement);
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      };

      img.src = imageUrl;
    };

    // Callback quando elemento entra/sai do viewport
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLoadedRef.current) {
          // Elemento está visível no viewport
          loadImage();
        }
      });
    };

    // Cria IntersectionObserver
    observerRef.current = new IntersectionObserver(
      handleIntersection,
      observerOptions
    );

    // Observa o elemento img
    observerRef.current.observe(imgElement);

    // Cleanup: remove observer quando componente desmonta
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [imageUrl, options?.threshold, options?.rootMargin, options?.root]);

  return {
    ref: imgRef,
    isLoaded,
    imageSrc,
  };
}
