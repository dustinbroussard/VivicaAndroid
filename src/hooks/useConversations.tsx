
import { useState, useEffect, useCallback } from 'react';
import { 
  getAllConversationsFromDb, 
  saveConversationsToDb, 
  deleteConversationFromDb,
  ConversationEntry 
} from '@/utils/indexedDb';
import { toast } from 'sonner';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  failed?: boolean;
  profileId?: string;
  isCodeResponse?: boolean;
  codeLoading?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage?: string;
  timestamp: Date;
  autoTitled?: boolean;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  const loadConversations = useCallback(async () => {
    const savedCurrent = localStorage.getItem('vivica-current-conversation');
    let convs: ConversationEntry[] = await getAllConversationsFromDb();

    if (convs.length === 0) {
      const legacy = localStorage.getItem('vivica-conversations');
      if (legacy) {
        try {
          convs = JSON.parse(legacy) as ConversationEntry[];
          await saveConversationsToDb(convs);
          localStorage.removeItem('vivica-conversations');
        } catch (e) {
          console.warn('Failed to parse legacy conversations', e);
        }
      }
    }

    if (convs.length > 0) {
      const parsedConversations: Conversation[] = convs.map((conv) => ({
        ...conv,
        timestamp: new Date(conv.timestamp),
        messages: conv.messages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        autoTitled: conv.autoTitled || false
      }));
      setConversations(parsedConversations);

      if (savedCurrent) {
        const current = parsedConversations.find((conv) => conv.id === savedCurrent);
        if (current) {
          setCurrentConversation(current);
        }
      } else {
        setCurrentConversation(parsedConversations[0]);
      }
    } else {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        timestamp: new Date(),
        autoTitled: false,
      };
      setConversations([newConversation]);
      setCurrentConversation(newConversation);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Persist conversations to IndexedDB
  useEffect(() => {
    if (conversations.length === 0) return;
    const handle = setTimeout(() => {
      const toSave: ConversationEntry[] = conversations.map(conv => ({
        ...conv,
        timestamp: conv.timestamp.toISOString(),
        messages: conv.messages.map(m => ({
          ...m,
          timestamp: m.timestamp.toISOString(),
        }))
      }));
      saveConversationsToDb(toSave).catch(e =>
        console.warn('Failed to save conversations', e)
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [conversations]);

  // Save current conversation ID
  useEffect(() => {
    if (currentConversation) {
      localStorage.setItem('vivica-current-conversation', currentConversation.id);
    }
  }, [currentConversation]);

  const handleNewChat = useCallback(() => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      timestamp: new Date(),
      autoTitled: false,
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversation(newConversation);
    toast.success("New conversation started!");
    return newConversation;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await deleteConversationFromDb(id);
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (currentConversation?.id === id) {
        setCurrentConversation(updated[0] || null);
      }
      return updated;
    });
  }, [currentConversation]);

  return {
    conversations,
    setConversations,
    currentConversation,
    setCurrentConversation,
    handleNewChat,
    deleteConversation,
    loadConversations
  };
}
