import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  it('returns default when key not set', () => {
    const { result } = renderHook(() => useLocalStorage('k1', 123));
    expect(result.current.value).toBe(123);
  });

  it('persists and reads JSON value', () => {
    const { result } = renderHook(() => useLocalStorage('k2', { a: 1 }));
    act(() => result.current.setValue({ a: 2 }));
    const { result: result2 } = renderHook(() => useLocalStorage('k2', { a: 0 }));
    expect(result2.current.value).toEqual({ a: 2 });
  });

  it('remove clears storage and resets to initial', () => {
    const { result } = renderHook(() => useLocalStorage('k3', 'x'));
    act(() => result.current.setValue('y'));
    act(() => result.current.remove());
    expect(result.current.value).toBe('x');
  });
});
