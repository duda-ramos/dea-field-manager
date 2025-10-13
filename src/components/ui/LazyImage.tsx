import React from 'react';
import { useLazyImage } from '@/hooks/useLazyImage';
import { cn } from '@/lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  wrapperClassName?: string;
  threshold?: number;
  rootMargin?: string;
}

/**
 * Componente de imagem com lazy loading
 * Carrega a imagem apenas quando ela fica visível no viewport
 * 
 * @example
 * ```tsx
 * <LazyImage 
 *   src="https://example.com/image.jpg" 
 *   alt="Descrição da imagem"
 *   className="w-full h-64 object-cover"
 * />
 * ```
 */
export const LazyImage = React.forwardRef<HTMLImageElement, LazyImageProps>(
  (
    {
      src,
      alt,
      className,
      placeholder,
      wrapperClassName,
      threshold = 0.5,
      rootMargin = '0px',
      ...props
    },
    forwardedRef
  ) => {
    const { ref: lazyRef, isLoaded, imageSrc } = useLazyImage(src, {
      threshold,
      rootMargin,
    });

    // Combina refs (internal + forwarded)
    const setRefs = React.useCallback(
      (node: HTMLImageElement | null) => {
        // Set internal ref
        (lazyRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
        
        // Set forwarded ref
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
        }
      },
      [forwardedRef, lazyRef]
    );

    return (
      <div className={cn('lazy-image-wrapper', wrapperClassName)}>
        <img
          ref={setRefs}
          src={isLoaded || !placeholder ? imageSrc : placeholder}
          alt={alt}
          className={cn(
            'lazy-image',
            'transition-all duration-500 ease-in-out',
            isLoaded ? 'lazy-image-loaded opacity-100 blur-0' : 'lazy-image-loading opacity-60 blur-sm',
            className
          )}
          loading="lazy"
          {...props}
        />
      </div>
    );
  }
);

LazyImage.displayName = 'LazyImage';
