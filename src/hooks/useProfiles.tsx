
import { useState, useEffect, useCallback } from 'react';
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { toast } from "sonner";
import { useTheme, ThemeColor, ThemeVariant } from "@/hooks/useTheme";

export interface Profile {
  id: string;
  name: string;
  model: string;
  fallbackModel?: string;
  codeModel?: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  isVivica?: boolean;
  useProfileTheme?: boolean;
  themeColor?: ThemeColor;
  themeVariant?: ThemeVariant;
  [key: string]: unknown;
}

export function useProfiles() {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const { setColor, setVariant } = useTheme();

  const applyProfileTheme = useCallback((profile: Profile) => {
    if (profile.useProfileTheme && profile.themeColor && profile.themeVariant) {
      const safeColor = (profile.themeColor as string === 'ai-choice' ? 'default' : profile.themeColor) as ThemeColor;
      setColor(safeColor);
      setVariant(profile.themeVariant as ThemeVariant);
    } else {
      const globalTheme = Storage.get(STORAGE_KEYS.THEME, { color: 'default', variant: 'dark' });
      const safeColor = (globalTheme.color === 'ai-choice' ? 'default' : globalTheme.color) as ThemeColor;
      setColor(safeColor);
      setVariant(globalTheme.variant as ThemeVariant);
    }
  }, [setColor, setVariant]);

  const loadCurrentProfile = useCallback(() => {
    const savedProfileId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE);
    let profiles: Profile[] = [];
    try {
      profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]');
      profiles = profiles.filter(p => 
        p.id && p.name && p.model && 
        typeof p.temperature === 'number' &&
        typeof p.maxTokens === 'number'
      );
    } catch {
      profiles = [];
    }

    if (!profiles.some(p => p.isVivica)) {
      const vivicaProfile = Storage.createVivicaProfile() as Profile;
      profiles.unshift(vivicaProfile);
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    }

    if (savedProfileId) {
      const profile = profiles.find(p => p.id === savedProfileId);
      if (profile) {
        setCurrentProfile(profile);
        applyProfileTheme(profile);
        return profile;
      }
    }
    
    if (profiles.length > 0) {
      setCurrentProfile(profiles[0]);
      applyProfileTheme(profiles[0]);
      localStorage.setItem(STORAGE_KEYS.CURRENT_PROFILE, profiles[0].id);
      return profiles[0];
    }
    return null;
  }, [applyProfileTheme]);

  const initializeProfiles = useCallback(() => {
    let profiles: Profile[] = Storage.get(STORAGE_KEYS.PROFILES, [] as Profile[]);
    const hasVivica = profiles.some((p) => p.isVivica);
    if (!hasVivica) {
      profiles.unshift(Storage.createVivicaProfile() as Profile);
    }
    if (profiles.length === 0) {
      profiles = [
        Storage.createVivicaProfile() as Profile,
        {
          id: '2',
          name: 'Creative Writer',
          model: 'gpt-4',
          fallbackModel: 'meta-llama/llama-3.3-70b-instruct:free',
          systemPrompt: 'You are a creative writing assistant specializing in storytelling and creative content.',
          temperature: 0.9,
          maxTokens: 3000,
          useProfileTheme: false,
          themeColor: 'default' as ThemeColor,
          themeVariant: 'dark' as ThemeVariant,
        },
      ];
    }
    Storage.set(STORAGE_KEYS.PROFILES, profiles);
  }, []);

  const handleProfileChange = useCallback((profile: Profile) => {
    setCurrentProfile(profile);
    localStorage.setItem(STORAGE_KEYS.CURRENT_PROFILE, profile.id);
    applyProfileTheme(profile);
    toast.success(`Switched to ${profile.name} profile`);
  }, [applyProfileTheme]);

  useEffect(() => {
    initializeProfiles();
    loadCurrentProfile();
    const handler = () => loadCurrentProfile();
    window.addEventListener('profilesUpdated', handler);
    return () => window.removeEventListener('profilesUpdated', handler);
  }, [initializeProfiles, loadCurrentProfile]);

  return {
    currentProfile,
    setCurrentProfile,
    handleProfileChange,
    loadCurrentProfile,
    applyProfileTheme
  };
}
