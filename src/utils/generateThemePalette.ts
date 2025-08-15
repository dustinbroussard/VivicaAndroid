import { ChatService, ChatMessage } from '@/services/chatService';
import { STORAGE_KEYS } from '@/utils/storage';
import { getPrimaryApiKey } from '@/utils/api';

export type ThemePalette = Record<string, string>;
export type DualThemePalette = {
  light: ThemePalette;
  dark: ThemePalette;
};

const basePalettes: Record<string, Record<string, [number, number, number]>> = {
  serene: {
    '--background': [210, 40, 96],
    '--foreground': [210, 30, 10],
    '--primary': [195, 60, 55],
    '--accent': [180, 70, 75],
  },
  fiery: {
    '--background': [10, 40, 95],
    '--foreground': [10, 30, 10],
    '--primary': [5, 70, 60],
    '--accent': [25, 85, 65],
  },
  mysterious: {
    '--background': [260, 40, 95],
    '--foreground': [260, 30, 10],
    '--primary': [250, 45, 50],
    '--accent': [280, 60, 70],
  },
  playful: {
    '--background': [50, 70, 95],
    '--foreground': [50, 30, 10],
    '--primary': [330, 70, 65],
    '--accent': [200, 80, 65],
  },
  romantic: {
    '--background': [340, 40, 95],
    '--foreground': [340, 25, 10],
    '--primary': [350, 60, 65],
    '--accent': [320, 70, 75],
  },
  fallback: {
    '--background': [0, 0, 100],
    '--foreground': [0, 0, 0],
    '--primary': [0, 0, 0],
    '--accent': [0, 0, 0],
  },
};

const randomWithin = (value: number, range: number) =>
  Math.max(0, Math.min(100, value + (Math.random() * 2 - 1) * range));

interface Profile {
  id: string;
  model: string;
  temperature: number;
  maxTokens: number;
  codeModel?: string;
}

export async function generateThemePalette(mood: string): Promise<DualThemePalette> {
  try {
    const profileId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE) || '';
    const rawProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]';
    const profiles: Profile[] = JSON.parse(rawProfiles);
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('No active profile');

    const apiKey = getPrimaryApiKey();
    if (!apiKey) throw new Error('missing api key');

    const chatService = new ChatService(apiKey);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You generate JSON containing CSS HSL color variables for both light and dark web themes. Respond with JSON having top-level keys "light" and "dark". Each theme should include keys "--background", "--foreground", "--primary", and "--accent" with values in the form "H S% L%".',
      },
      {
        role: 'user',
        content: `Mood: ${mood}`,
      },
    ];

    const res = await chatService.sendMessage({
      model: profile.model,
      messages,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const palette = JSON.parse(content) as DualThemePalette;
    return palette;
  } catch (e) {
    console.warn('Falling back to base palette for mood', mood, e);
    const base = basePalettes[mood as keyof typeof basePalettes] || basePalettes.fallback;

    const buildPalette = (): ThemePalette => {
      const palette: ThemePalette = {};
      Object.entries(base).forEach(([key, [h, s, l]]) => {
        palette[key] = `${Math.round(randomWithin(h, 5))} ${Math.round(
          randomWithin(s, 5)
        )}% ${Math.round(randomWithin(l, 5))}%`;
      });
      return palette;
    };

    return { light: buildPalette(), dark: buildPalette() };
  }
}
