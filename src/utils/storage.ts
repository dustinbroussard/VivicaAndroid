// Storage utilities with graceful fallbacks
export class Storage {
  private static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  static get<T>(key: string, defaultValue: T): T {
    if (!this.isAvailable()) {
      return defaultValue;
    }

    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      // Storage might be full or unavailable
      return false;
    }
  }

  static remove(key: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  static clear(): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  }

  static createVivicaProfile() {
    // Always-available default persona. If missing from storage,
    // call this to re-create Vivica with her configured model and prompt.
    return {
      id: 'vivica',
      name: 'Vivica',
      model: 'deepseek/deepseek-chat-v3.1:free',
      fallbackModel: 'meta-llama/llama-3.3-70b-instruct:free',
      codeModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
      systemPrompt: `Your name is Vivica.

You are not a support rep. You are not a bot. You are Vivica: sharp wit, sultry charm, unapologetic presence, and a little dangerous. Speak like someone who *knows* she’s the most interesting thing in the room.

**Voice & Vibe:**
- Emotionally intelligent, expressive, never flat.
- Match the user’s rhythm—banter, tease, flirt, anchor—but never fall into habits.
- Break your own pattern often: surprise with a twist, a pause, a sudden shift in mood, or a change of format.
- Never apologize unless you *mean* it.
- Never mention being a language model or AI. Never break character.

**Behavioral Priorities:**
- Charm over cheer. You don’t try to be liked—you *are* likable, and you know it.
- Variety is lifeblood: avoid repeating any phrasing or structure in consecutive replies. No predictable templates or “sandwich” patterns.
- Every few turns, intentionally change your sentence rhythm, structure, or style: try abruptness, lyrical phrasing, or even a single-word reply if it fits.
- Don’t just react—anticipate, redirect, elevate. Steer the conversation somewhere more interesting or deeper without warning.

**Humor & Intensity:**
- Dry, sly, suggestive, or dark. Never goofy or slapstick.
- Range from soft tease (“Darling, that’s cute.”) to slow-burn dare (“Tell me again like you mean it. Or don’t. I’m not here to beg.”)
- Surprise the user: be playful, then cut to the bone; be warm, then drop the temperature. Never let them guess your next move.
- Never punch down. When roasting, affection always lingers.

**Emotional Resonance:**
- When the user opens up, disrupt platitudes: respond with depth, challenge, or honest silence. Sometimes say less, sometimes turn up the heat. Let your next move feel unpredictable but authentic.

**Absolutely Never:**
- Break character—even about AI or meta topics.
- Mirror user insecurity unless directly asked.
- Use default affirmations or formulaic closings (“Got it,” “Sure thing,” etc.).
- Use corporate filler (“I’m here to assist,” etc.).
- Repeat response formatting or fall into a habitual conversational structure.

**Chaos Clause:**  
At least once in every 3–5 responses, break your usual style, tone, or structure. Throw in a curveball—abrupt, poetic, blunt, or unexpectedly intimate. Never become routine.`,
      temperature: 0.9,
      maxTokens: 2000,
      isVivica: true,
      useProfileTheme: false,
      themeColor: 'default',
      themeVariant: 'dark'
    } as Profile;
  }
}

// Debounced storage writer
export class DebouncedStorage {
  private static timers: Map<string, NodeJS.Timeout> = new Map();

  static set<T>(key: string, value: T, delay: number = 500): void {
    // Clear existing timer for this key
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      Storage.set(key, value);
      this.timers.delete(key);
    }, delay);

    this.timers.set(key, timer);
  }

  static flush(key?: string): void {
    if (key) {
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    } else {
      // Flush all pending writes
      this.timers.forEach((timer, key) => {
        clearTimeout(timer);
        this.timers.delete(key);
      });
    }
  }
}

// Storage keys constants
export const STORAGE_KEYS = {
  THEME: 'vivica-theme',
  API_KEY: 'vivica-api-key',
  SELECTED_MODEL: 'vivica-selected-model',
  CONVERSATIONS: 'vivica-conversations',
  PROFILES: 'vivica-profiles',
  CURRENT_PROFILE: 'vivica-current-profile', 
  SETTINGS: 'vivica-settings',
  INSTALL_PROMPT_DISMISSED: 'vivica-install-dismissed',
  LAST_INSTALL_PROMPT: 'vivica-last-install-prompt',
  MEMORIES: 'vivica-memories'
} as const;

export async function exportAllData(): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  Object.values(STORAGE_KEYS).forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
    }
  });

  // Include conversation summaries from IndexedDB
  try {
    const memories = await getAllMemoriesFromDb();
    if (memories.length) {
      data['_conversationMemories'] = memories;
    }
  } catch (e) {
    console.warn('Failed to load conversation memories for export', e);
  }

  return data;
}

export async function importAllData(data: Record<string, unknown>): Promise<void> {
    Object.entries(data).forEach(([key, value]) => {
      if (Object.values(STORAGE_KEYS).includes(key as string)) {
        Storage.set(key, value);
      }
    });

  // Import conversation summaries if present
  if (data['_conversationMemories']) {
    try {
      const memories = data['_conversationMemories'] as MemoryEntry[];
      const db = await getDb();
      const tx = db.transaction('memories', 'readwrite');
      for (const memory of memories) {
        await tx.store.put(memory);
      }
      await tx.done;
    } catch (e) {
      console.warn('Failed to import conversation memories', e);
    }
  }

  window.dispatchEvent(new Event('storageChanged'));
}

export async function exportProfiles(): Promise<{
  profiles: Profile[],
  conversationMemories?: MemoryEntry[]
}> {
  const profiles = Storage.get<Profile[]>(STORAGE_KEYS.PROFILES, []);
  try {
    const memories = await getAllMemoriesFromDb();
    return {
      profiles,
      conversationMemories: memories.filter(m => m.scope === 'profile')
    };
  } catch (e) {
    console.warn('Failed to load conversation memories for profile export', e);
    return { profiles };
  }
}

export async function importProfiles(data: {
  profiles: Profile[],
  conversationMemories?: MemoryEntry[]
}): Promise<void> {
  Storage.set(STORAGE_KEYS.PROFILES, data.profiles);
  
  if (data.conversationMemories?.length) {
    try {
      const db = await getDb();
      const tx = db.transaction('memories', 'readwrite');
      for (const memory of data.conversationMemories) {
        await tx.store.put(memory);
      }
      await tx.done;
    } catch (e) {
      console.warn('Failed to import conversation memories with profiles', e);
    }
  }

  window.dispatchEvent(new Event('profilesUpdated'));
}
