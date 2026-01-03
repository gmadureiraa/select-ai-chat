import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type OnboardingType = "new_workspace" | "joining_workspace" | null;

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  dismissedTooltips: string[];
  onboardingType: OnboardingType;
}

const STORAGE_KEY = "kai-onboarding-state";

const getStoredState = (): OnboardingState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        hasCompletedOnboarding: parsed.hasCompletedOnboarding ?? false,
        currentStep: parsed.currentStep ?? 0,
        dismissedTooltips: parsed.dismissedTooltips ?? [],
        onboardingType: parsed.onboardingType ?? null,
      };
    }
  } catch (e) {
    console.error("Failed to parse onboarding state", e);
  }
  return {
    hasCompletedOnboarding: false,
    currentStep: 0,
    dismissedTooltips: [],
    onboardingType: null,
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
  const { user } = useAuth();
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is workspace owner on mount
  useEffect(() => {
    const checkOwnership = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Check if user owns any workspace
        const { data: workspaces } = await supabase
          .from("workspaces")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1);

        const isOwner = workspaces && workspaces.length > 0;
        setIsWorkspaceOwner(isOwner);

        // If onboarding not completed and we don't know the type yet, determine it
        if (!state.hasCompletedOnboarding && !state.onboardingType) {
          setState((prev) => ({
            ...prev,
            onboardingType: isOwner ? "new_workspace" : "joining_workspace",
          }));
        }
      } catch (err) {
        console.error("Error checking workspace ownership:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkOwnership();
  }, [user, state.hasCompletedOnboarding, state.onboardingType]);

  // Sync to localStorage whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const shouldShowOnboarding = !state.hasCompletedOnboarding && !isLoading;
  const onboardingType = state.onboardingType;

  const setOnboardingType = useCallback((type: OnboardingType) => {
    setState((prev) => ({
      ...prev,
      onboardingType: type,
    }));
  }, []);

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
      onboardingType: null,
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
    onboardingType,
    isWorkspaceOwner,
    isLoading,
    
    // Onboarding actions
    setOnboardingType,
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
