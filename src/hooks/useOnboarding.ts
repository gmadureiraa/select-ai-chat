import { useState, useEffect, useCallback } from "react";

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  dismissedTooltips: string[];
}

const STORAGE_KEY = "kai-onboarding-state";

const getStoredState = (): OnboardingState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to parse onboarding state", e);
  }
  return {
    hasCompletedOnboarding: false,
    currentStep: 0,
    dismissedTooltips: [],
  };
};

const saveState = (state: OnboardingState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save onboarding state", e);
  }
};

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(getStoredState);

  // Sync to localStorage whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const shouldShowOnboarding = !state.hasCompletedOnboarding;

  const completeOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
      currentStep: 0,
    }));
  }, []);

  const skipOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
      currentStep: 0,
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: prev.currentStep + 1,
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: step,
    }));
  }, []);

  const resetOnboarding = useCallback(() => {
    setState({
      hasCompletedOnboarding: false,
      currentStep: 0,
      dismissedTooltips: [],
    });
  }, []);

  // Tooltip management
  const isTooltipDismissed = useCallback(
    (tooltipId: string) => {
      return state.dismissedTooltips.includes(tooltipId);
    },
    [state.dismissedTooltips]
  );

  const dismissTooltip = useCallback((tooltipId: string) => {
    setState((prev) => ({
      ...prev,
      dismissedTooltips: [...new Set([...prev.dismissedTooltips, tooltipId])],
    }));
  }, []);

  const resetTooltips = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dismissedTooltips: [],
    }));
  }, []);

  return {
    // Onboarding state
    shouldShowOnboarding,
    currentStep: state.currentStep,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    
    // Onboarding actions
    completeOnboarding,
    skipOnboarding,
    nextStep,
    prevStep,
    goToStep,
    resetOnboarding,
    
    // Tooltip management
    isTooltipDismissed,
    dismissTooltip,
    resetTooltips,
  };
}
