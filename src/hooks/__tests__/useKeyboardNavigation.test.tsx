import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNavigation } from '../useKeyboardNavigation';

describe('useKeyboardNavigation', () => {
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnNavigate: ReturnType<typeof vi.fn>;
  let mockOnActivate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClose = vi.fn();
    mockOnNavigate = vi.fn();
    mockOnActivate = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when modal is open', () => {
    it('should call onClose when Escape is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onNavigate: mockOnNavigate,
          onActivate: mockOnActivate
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      document.dispatchEvent(event);

      expect(mockOnClose).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should call onNavigate with "up" when ArrowUp is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onNavigate: mockOnNavigate
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      document.dispatchEvent(event);

      expect(mockOnNavigate).toHaveBeenCalledWith('up');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should call onNavigate with "down" when ArrowDown is pressed', () => {
      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onNavigate: mockOnNavigate
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      document.dispatchEvent(event);

      expect(mockOnNavigate).toHaveBeenCalledWith('down');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not call onNavigate when not provided', () => {
      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      const eventUp = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const eventDown = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const preventDefaultSpy = vi.fn();

      Object.defineProperty(eventUp, 'preventDefault', { value: preventDefaultSpy });
      Object.defineProperty(eventDown, 'preventDefault', { value: preventDefaultSpy });

      document.dispatchEvent(eventUp);
      document.dispatchEvent(eventDown);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should call onActivate when Enter is pressed on a button role element', () => {
      const mockButton = document.createElement('div');
      mockButton.setAttribute('role', 'button');
      document.body.appendChild(mockButton);

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onActivate: mockOnActivate
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(event, 'target', { value: mockButton });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      document.dispatchEvent(event);

      expect(mockOnActivate).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();

      document.body.removeChild(mockButton);
    });

    it('should call onActivate when Space is pressed on a button role element', () => {
      const mockButton = document.createElement('div');
      mockButton.setAttribute('role', 'button');
      document.body.appendChild(mockButton);

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onActivate: mockOnActivate
        })
      );

      const event = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(event, 'target', { value: mockButton });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      document.dispatchEvent(event);

      expect(mockOnActivate).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();

      document.body.removeChild(mockButton);
    });

    it('should not call onActivate when Enter is pressed on non-button elements', () => {
      const mockDiv = document.createElement('div');
      document.body.appendChild(mockDiv);

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onActivate: mockOnActivate
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(event, 'target', { value: mockDiv });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

      document.dispatchEvent(event);

      expect(mockOnActivate).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();

      document.body.removeChild(mockDiv);
    });

    it('should not call onActivate when not provided', () => {
      const mockButton = document.createElement('div');
      mockButton.setAttribute('role', 'button');
      document.body.appendChild(mockButton);

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(event, 'target', { value: mockButton });
      const preventDefaultSpy = vi.fn();
      Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy });

      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();

      document.body.removeChild(mockButton);
    });

    it('should allow default Tab behavior', () => {
      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      const preventDefaultSpy = vi.fn();
      Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy });

      document.dispatchEvent(event);

      // Tab should not prevent default
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should ignore unhandled keys', () => {
      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onNavigate: mockOnNavigate,
          onActivate: mockOnActivate
        })
      );

      const keys = ['a', 'b', 'Home', 'End', 'PageUp', 'PageDown'];

      keys.forEach(key => {
        const event = new KeyboardEvent('keydown', { key });
        const preventDefaultSpy = vi.fn();
        Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy });

        document.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnNavigate).not.toHaveBeenCalled();
      expect(mockOnActivate).not.toHaveBeenCalled();
    });

    it('should focus first focusable element on open', () => {
      const mockButton = document.createElement('button');
      mockButton.textContent = 'Click me';
      document.body.appendChild(mockButton);

      const focusSpy = vi.spyOn(mockButton, 'focus');

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      vi.advanceTimersByTime(100);

      expect(focusSpy).toHaveBeenCalled();

      document.body.removeChild(mockButton);
    });

    it('should handle modal with multiple focusable elements', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const input = document.createElement('input');

      document.body.appendChild(button1);
      document.body.appendChild(button2);
      document.body.appendChild(input);

      const focusSpy = vi.spyOn(button1, 'focus');

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      vi.advanceTimersByTime(100);

      // Should focus first element
      expect(focusSpy).toHaveBeenCalled();

      document.body.removeChild(button1);
      document.body.removeChild(button2);
      document.body.removeChild(input);
    });

    it('should handle modal with no focusable elements', () => {
      // Clear any existing focusable elements
      const existingElements = document.querySelectorAll('button, input, select, textarea, [href]');
      existingElements.forEach(el => el.remove());

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      vi.advanceTimersByTime(100);

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('when modal is closed', () => {
    it('should not handle keyboard events when isOpen is false', () => {
      renderHook(() =>
        useKeyboardNavigation({
          isOpen: false,
          onClose: mockOnClose,
          onNavigate: mockOnNavigate,
          onActivate: mockOnActivate
        })
      );

      const events = [
        new KeyboardEvent('keydown', { key: 'Escape' }),
        new KeyboardEvent('keydown', { key: 'ArrowUp' }),
        new KeyboardEvent('keydown', { key: 'ArrowDown' }),
        new KeyboardEvent('keydown', { key: 'Enter' })
      ];

      events.forEach(event => {
        document.dispatchEvent(event);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnNavigate).not.toHaveBeenCalled();
      expect(mockOnActivate).not.toHaveBeenCalled();
    });

    it('should not set up focus trap when closed', () => {
      const mockButton = document.createElement('button');
      document.body.appendChild(mockButton);

      const focusSpy = vi.spyOn(mockButton, 'focus');

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: false,
          onClose: mockOnClose
        })
      );

      vi.advanceTimersByTime(100);

      expect(focusSpy).not.toHaveBeenCalled();

      document.body.removeChild(mockButton);
    });
  });

  describe('lifecycle', () => {
    it('should clean up event listeners on unmount', () => {
      const { unmount } = renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose,
          onNavigate: mockOnNavigate
        })
      );

      unmount();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      // Should not call handlers after unmount
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should update event listeners when isOpen changes', () => {
      const { rerender } = renderHook(
        ({ isOpen }) =>
          useKeyboardNavigation({
            isOpen,
            onClose: mockOnClose
          }),
        { initialProps: { isOpen: true } }
      );

      // Trigger event while open
      let event = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      document.dispatchEvent(event);

      expect(mockOnClose).toHaveBeenCalledTimes(1);

      // Close the modal
      rerender({ isOpen: false });

      // Trigger event while closed
      event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      // Should not call again
      expect(mockOnClose).toHaveBeenCalledTimes(1);

      // Reopen the modal
      rerender({ isOpen: true });

      // Trigger event while open again
      event = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      document.dispatchEvent(event);

      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });

    it('should update handlers when they change', () => {
      const newOnClose = vi.fn();

      const { rerender } = renderHook(
        ({ onClose }) =>
          useKeyboardNavigation({
            isOpen: true,
            onClose
          }),
        { initialProps: { onClose: mockOnClose } }
      );

      rerender({ onClose: newOnClose });

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      document.dispatchEvent(event);

      expect(newOnClose).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('focus trap', () => {
    it('should handle various focusable element types', () => {
      // Clean up DOM
      document.body.innerHTML = '';

      const button = document.createElement('button');
      const link = document.createElement('a');
      link.href = '#';
      const input = document.createElement('input');
      const select = document.createElement('select');
      const textarea = document.createElement('textarea');
      const divWithTabIndex = document.createElement('div');
      divWithTabIndex.tabIndex = 0;

      document.body.appendChild(button);
      document.body.appendChild(link);
      document.body.appendChild(input);
      document.body.appendChild(select);
      document.body.appendChild(textarea);
      document.body.appendChild(divWithTabIndex);

      const focusSpy = vi.spyOn(button, 'focus');

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      vi.advanceTimersByTime(100);

      expect(focusSpy).toHaveBeenCalled();

      // Clean up
      document.body.innerHTML = '';
    });

    it('should skip elements with tabindex="-1"', () => {
      document.body.innerHTML = '';

      const divNegativeTab = document.createElement('div');
      divNegativeTab.tabIndex = -1;
      const button = document.createElement('button');

      document.body.appendChild(divNegativeTab);
      document.body.appendChild(button);

      const focusSpy = vi.spyOn(button, 'focus');

      renderHook(() =>
        useKeyboardNavigation({
          isOpen: true,
          onClose: mockOnClose
        })
      );

      vi.advanceTimersByTime(100);

      // Should skip divNegativeTab and focus button
      expect(focusSpy).toHaveBeenCalled();

      document.body.innerHTML = '';
    });
  });
});
