import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuthContext';

const ONBOARDING_STORAGE_KEY = 'dea-onboarding-completed';

// Hook to manage onboarding state
export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
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
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setHasCompletedOnboarding(false);
  };

  const startOnboarding = () => {
    setShowOnboarding(true);
  };

  return {
    hasCompletedOnboarding,
    showOnboarding,
    markOnboardingComplete,
    resetOnboarding,
    startOnboarding,
    closeOnboarding: () => setShowOnboarding(false)
  };
}
