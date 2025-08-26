// src/services/lifecycle/pageLifecycle.ts - Modern page lifecycle management
import { logger } from '@/services/logger';

type LifecycleEventType = 'visible' | 'hidden' | 'frozen' | 'resumed' | 'terminated';
type LifecycleCallback = (event: LifecycleEventType) => void | Promise<void>;

class PageLifecycleManager {
  private callbacks: Map<string, LifecycleCallback> = new Map();
  private isVisible = !document.hidden;
  private isFrozen = false;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Modern visibility change handling
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isVisible;
      this.isVisible = !document.hidden;
      
      if (wasVisible !== this.isVisible) {
        this.emitEvent(this.isVisible ? 'visible' : 'hidden');
      }
    });

    // Page lifecycle events for better mobile support
    window.addEventListener('pagehide', (event) => {
      // Page is being unloaded or cached
      if (!event.persisted) {
        this.emitEvent('terminated');
      }
    });

    // Freeze/resume events (Chrome 68+)
    document.addEventListener('freeze', () => {
      this.isFrozen = true;
      this.emitEvent('frozen');
    });

    document.addEventListener('resume', () => {
      this.isFrozen = false;
      this.emitEvent('resumed');
    });

    // Focus/blur as fallback for older browsers
    window.addEventListener('focus', () => {
      if (!this.isVisible) {
        this.isVisible = true;
        this.emitEvent('visible');
      }
    });

    window.addEventListener('blur', () => {
      if (this.isVisible) {
        this.isVisible = false;
        this.emitEvent('hidden');
      }
    });
  }

  private emitEvent(eventType: LifecycleEventType) {
    logger.debug(`Page lifecycle event: ${eventType}`);
    
    this.callbacks.forEach((callback, id) => {
      try {
        callback(eventType);
      } catch (error) {
        logger.error(`Lifecycle callback error for ${id}:`, error);
      }
    });
  }

  // Register a callback for lifecycle events
  subscribe(id: string, callback: LifecycleCallback) {
    this.callbacks.set(id, callback);
    return () => this.callbacks.delete(id);
  }

  // Get current page state
  getState() {
    return {
      isVisible: this.isVisible,
      isFrozen: this.isFrozen,
      isHidden: document.hidden
    };
  }

  // Clean up all listeners
  destroy() {
    this.callbacks.clear();
  }
}

// Export singleton instance
export const pageLifecycleManager = new PageLifecycleManager();