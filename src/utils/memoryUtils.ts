import { ChatMessage, ChatService } from "@/services/chatService";
import { toast } from "sonner";
import {
  saveMemoryToDb,
  deleteMemoryFromDb,
  getAllMemoriesFromDb,
  getMemoriesForProfile,
  clearAllMemoriesFromDb
} from './indexedDb';

interface MemoryItem {
  id: string;
  content: string;
  scope: 'global' | 'profile';
  profileId?: string;
  createdAt: string;
  tags: string[];
}

// Memory helpers for IndexedDB storage. Prompt building now reads from
// the DB, so these entries fully influence Vivica's replies. The legacy
// `vivica-memory` key has been retired in favor of scoped keys.

/**
 * Saves a new memory item with scope control
 * @param content - Memory content text
 * @param scope - 'global' or 'profile' scope
 * @param profileId - Required for profile-scoped memories
 * @returns Promise with saved memory data
 */
export async function saveMemory(content: string, scope: 'global' | 'profile', profileId?: string): Promise<MemoryItem> {
  const memory: MemoryItem = {
    id: `memory-${Date.now()}`,
    content,
    scope,
    profileId: scope === 'profile' ? profileId : undefined,
    createdAt: new Date().toISOString(),
    tags: scope === 'global' ? ['global'] : ['profile']
  };

  // Persist new memory in IndexedDB
  await saveMemoryToDb(memory);

  return memory;
}

/**
 * Gets memories filtered by scope
 * @param profileId - Required to get profile-specific memories
 * @param scopeFilter - Optional filter ('global' | 'profile' | 'all')
 * @returns Filtered array of MemoryItem
 */
export async function getMemories(profileId?: string, scopeFilter: 'global' | 'profile' | 'all' = 'all'): Promise<MemoryItem[]> {
  const all = await getMemoriesForProfile(profileId);
  switch (scopeFilter) {
    case 'global':
      return all.filter(m => m.scope === 'global');
    case 'profile':
      return all.filter(m => m.scope === 'profile' && m.profileId === profileId);
    default:
      return all;
  }
}

/** Update an existing memory item */
export async function editMemory(id: string, newContent: string): Promise<MemoryItem | undefined> {
  const all = await getAllMemoriesFromDb();
  const item = all.find(m => m.id === id);
  if (!item) return undefined;
  const updated = { ...item, content: newContent };
  await saveMemoryToDb(updated);
  return updated;
}

/** Remove a memory item by id */
export async function deleteMemory(id: string): Promise<void> {
  await deleteMemoryFromDb(id);
}

/** Remove all stored memories */
export async function clearAllMemories(): Promise<void> {
  await clearAllMemoriesFromDb();
}

/**
 * Summarizes a conversation and saves it to memory
 * @param messages - Chat messages to summarize
 * @param model - Model name for summarization
 * @param apiKey - API key for LLM calls
 * @param scope - Memory scope ('global' or 'profile')
 * @param profileId - Required for profile memories
 * @returns Promise with saved memory data
 */
// Used by the "Save & Summarize" button in ChatHeader
export async function saveConversationMemory(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  scope: 'global' | 'profile' = 'global',
  profileId?: string
): Promise<MemoryItem> {
  // Enhanced prompt with scope awareness
  const scopeHint = scope === 'profile'
    ? "This is a persona-specific memory - focus on details relevant to this persona's specialty."
    : "This is a global memory - keep it broadly applicable to all personas.";

  const messageCount = messages.length;
  // Allow much longer memory summaries so important details aren't lost
  const charLimit = messageCount < 10 ? 1000 : messageCount <= 30 ? 2000 : 4000;

  const prompt = `
  As Vivica, create a ${scope} memory from this conversation.
  ${scopeHint}

  Keep the entire summary under ${charLimit} characters.

  Format requirements:
  1. Start with "Summary:" followed by 1-2 sentence overview
  2. List key points as bullets
  3. Keep professional but friendly tone

  Key Points to Include:
  - Important facts/names
  - User preferences
  - Key decisions
  - Special instructions

  Conversation:
  ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

  Response Format:
  Summary: [summary here]
  Key Points:
  - [point 1]
  - [point 2]
  - [...]
  `;

  try {
    const chatService = new ChatService(apiKey);
    const data = await chatService.sendMessageJson<{ choices: { message: { content?: string } }[] }>({
      model,
      messages: [
        { role: 'system', content: 'You are Vivica, summarizing conversations concisely.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3 // Lower temp for more factual summaries
    });
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      throw new Error('No summary generated');
    }

    // Clean up the response if it has bullet points
    let cleanedSummary = summary
      .replace(/^- /mg, '• ') // Convert hyphens to bullets
      .replace(/\n\s*\n/g, '\n\n'); // Normalize spacing

    if (cleanedSummary.length > charLimit) {
      cleanedSummary = cleanedSummary.slice(0, charLimit);
    }

    const memoryData = {
      id: `memory-${Date.now()}`,
      content: cleanedSummary,
      createdAt: new Date().toISOString(),
      tags: ['auto-summary']
    };

    await saveMemory(cleanedSummary, scope, profileId);
    toast.success("Conversation saved to memory!");
    return memoryData;
  } catch (error) {
    console.error('Failed to save memory:', error);
    toast.error("Failed to save summary");
    throw error;
  }
}
