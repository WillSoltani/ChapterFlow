"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

/* ── Types ── */

export interface UserPreferences {
  motivation: string;
  interests: string[];
  tone: "gentle" | "direct" | "competitive";
  dailyGoal: number;
  chapterOrder: "summary_first" | "scenarios_first";
  scenarioFocus: "work" | "school" | "personal" | "mixed";
  starterShelf: string[];
  onboardingCompleted: boolean;
}

interface PreferencesContextType {
  preferences: UserPreferences | null;
  loading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_CONTEXT: PreferencesContextType = {
  preferences: null,
  loading: true,
  updatePreferences: async () => {},
  refetch: async () => {},
};

const PreferencesContext = createContext<PreferencesContextType>(DEFAULT_CONTEXT);

/* ── Provider ── */

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/book/me/settings");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const settings = data.settings;
      if (!settings) {
        setLoading(false);
        return;
      }

      const onboarding = settings.onboarding as Record<string, unknown> | undefined;
      if (onboarding?.onboardingCompleted) {
        setPreferences({
          motivation: (onboarding.motivation as string) || "personal",
          interests: (onboarding.interests as string[]) || [],
          tone: (settings.tone as UserPreferences["tone"]) || "direct",
          dailyGoal: (settings.dailyGoal as number) || 20,
          chapterOrder: (settings.chapterOrder as UserPreferences["chapterOrder"]) || "summary_first",
          scenarioFocus: (settings.scenarioFocus as UserPreferences["scenarioFocus"]) || "mixed",
          starterShelf: (onboarding.starterShelf as string[]) || [],
          onboardingCompleted: true,
        });
      }
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Retry any pending onboarding save from a failed previous attempt
  useEffect(() => {
    try {
      const pending = localStorage.getItem("chapterflow_onboarding_pending");
      if (pending) {
        const data = JSON.parse(pending);
        fetch("/api/book/me/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
          .then((res) => {
            if (res.ok) {
              localStorage.removeItem("chapterflow_onboarding_pending");
              fetchPreferences(); // Refresh after successful retry
            }
          })
          .catch(() => {}); // Silent — will retry on next page load
      }
    } catch {}
  }, [fetchPreferences]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    try {
      const res = await fetch("/api/book/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setPreferences((prev) => (prev ? { ...prev, ...updates } : null));
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ preferences, loading, updatePreferences, refetch: fetchPreferences }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

/* ── Hook ── */

export function useUserPreferences() {
  return useContext(PreferencesContext);
}
