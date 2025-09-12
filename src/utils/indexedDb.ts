import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface MemoryEntry {
  id: string;
  content: string;
  scope: 'global' | 'profile';
  profileId?: string;
  createdAt: string;
  tags: string[];
}

interface WelcomeMessage {
  id?: number;
  text: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  failed?: boolean;
  isCodeResponse?: boolean;
}

export interface ConversationEntry {
  id: string;
  title: string;
  messages: ConversationMessage[];
  lastMessage?: string;
  timestamp: string;
  autoTitled?: boolean;
}

interface VivicaDb extends DBSchema {
  memories: {
    key: string;
    value: MemoryEntry;
    indexes: { 'by-profile': string };
  };
  welcomeMessages: {
    key: number;
    value: WelcomeMessage;
  };
  conversations: {
    key: string;
    value: ConversationEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<VivicaDb>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<VivicaDb>('vivica-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('memories', { keyPath: 'id' });
          store.createIndex('by-profile', 'profileId');
          db.createObjectStore('welcomeMessages', { keyPath: 'id', autoIncrement: true });
        }
        if (oldVersion < 2) {
          db.createObjectStore('conversations', { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

export async function saveMemoryToDb(entry: MemoryEntry) {
  const db = await getDb();
  await db.put('memories', entry);
  return entry;
}

export async function deleteMemoryFromDb(id: string) {
  const db = await getDb();
  await db.delete('memories', id);
}

export async function getAllMemoriesFromDb() {
  const db = await getDb();
  return db.getAll('memories');
}

export async function getMemoriesForProfile(profileId?: string) {
  const db = await getDb();
  const all = await db.getAll('memories');
  return all.filter(m => (m.scope === 'global') || (m.scope === 'profile' && m.profileId === profileId));
}

export async function clearAllMemoriesFromDb() {
  const db = await getDb();
  await db.clear('memories');
}

export async function saveWelcomeMessage(text: string) {
  const db = await getDb();
  await db.add('welcomeMessages', { text, createdAt: new Date().toISOString() });
  const messages = await db.getAll('welcomeMessages');
  if (messages.length > 10) {
    const excess = messages.sort((a,b) => (a.id! - b.id!)).slice(0, messages.length - 10);
    for (const msg of excess) {
      if (msg.id !== undefined) await db.delete('welcomeMessages', msg.id);
    }
  }
}

export async function getCachedWelcomeMessages() {
  const db = await getDb();
  return db.getAll('welcomeMessages');
}

// Conversation persistence helpers
export async function getAllConversationsFromDb(): Promise<ConversationEntry[]> {
  const db = await getDb();
  return db.getAll('conversations');
}

export async function saveConversationsToDb(conversations: ConversationEntry[]) {
  const db = await getDb();
  const tx = db.transaction('conversations', 'readwrite');
  for (const conv of conversations) {
    await tx.store.put(conv);
  }
  await tx.done;
}

export async function deleteConversationFromDb(id: string) {
  const db = await getDb();
  await db.delete('conversations', id);
}

export async function clearAllConversationsFromDb() {
  const db = await getDb();
  await db.clear('conversations');
}
