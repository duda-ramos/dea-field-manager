import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuthContext';

const ONBOARDING_STORAGE_KEY_PREFIX = 'dea-onboarding-completed';

// Hook to manage onboarding state
export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user } = useAuth();

  // Generate user-specific storage key
  const getStorageKey = () => {
    if (!user?.id) return null;
    return `${ONBOARDING_STORAGE_KEY_PREFIX}-${user.id}`;
  };

  useEffect(() => {
    if (user) {
      const storageKey = getStorageKey();
      if (!storageKey) return;
      
      const completed = localStorage.getItem(storageKey);
      const hasCompleted = completed === 'true';
      setHasCompletedOnboarding(hasCompleted);
      
      // Show onboarding for new users after a short delay
      if (!hasCompleted) {
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const markOnboardingComplete = () => {
    const storageKey = getStorageKey();
    if (!storageKey) return;
    
    localStorage.setItem(storageKey, 'true');
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    const storageKey = getStorageKey();
    if (!storageKey) return;
    
    localStorage.removeItem(storageKey);
    setHasCompletedOnboarding(false);
  };

  const startOnboarding = () => {
    setShowOnboarding(true);
  };

  const closeOnboarding = () => {
    // When user closes onboarding, mark as completed to prevent showing again
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
      setHasCompletedOnboarding(true);
    }
    setShowOnboarding(false);
  };

  return {
    hasCompletedOnboarding,
    showOnboarding,
    markOnboardingComplete,
    resetOnboarding,
    startOnboarding,
    closeOnboarding
  };
}
