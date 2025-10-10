import { useEffect, useState } from 'react';

/**
 * Custom hook that debounces a value
 * 
 * @template T - The type of the value to debounce
 * @param {T} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {T} The debounced value
 * 
 * @example
 * ```typescript
 * // Debounce search input
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 500);
 * 
 * useEffect(() => {
 *   // This will only run 500ms after the user stops typing
 *   if (debouncedQuery) {
 *     performSearch(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 * ```
 * 
 * @example
 * ```typescript
 * // Debounce filter object
 * const [filters, setFilters] = useState({ category: '', price: 0 });
 * const debouncedFilters = useDebounce(filters, 300);
 * 
 * useEffect(() => {
 *   fetchProducts(debouncedFilters);
 * }, [debouncedFilters]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout to update debounced value after delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes before delay completes (cleanup)
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]); // Re-run effect when value or delay changes

  return debouncedValue;
}
