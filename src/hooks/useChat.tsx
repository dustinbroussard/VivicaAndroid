
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ChatService, ChatMessage } from "@/services/chatService";
import { fetchRSSHeadlines } from "@/services/rssService";
import { getPromptWeatherText } from "@/services/weatherService";
import { getMemories } from "@/utils/memoryUtils";
import { Storage, STORAGE_KEYS } from "@/utils/storage";
import { getPrimaryApiKey } from "@/utils/api";
import { Message, Conversation } from "./useConversations";
import { Profile } from "./useProfiles";

type StoredMemoryShape = {
  identity?: {
    name?: string;
    pronouns?: string;
    occupation?: string;
    location?: string;
  };
  personality?: {
    tone?: string;
    style?: string;
    interests?: string;
  };
  customInstructions?: string;
  systemNotes?: string;
};

export function useChat(
  currentConversation: Conversation | null,
  setCurrentConversation: React.Dispatch<React.SetStateAction<Conversation | null>>,
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
) {
  const [isTyping, setIsTyping] = useState(false);
  const activeSendIdRef = useRef(0);
  const activeRequestAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      activeRequestAbortRef.current?.abort();
      activeRequestAbortRef.current = null;
    };
  }, []);

  const parseStreamingContent = (text: string) => {
    const regex = /```/g;
    let match;
    let openIndex = -1;
    let open = false;
    while ((match = regex.exec(text)) !== null) {
      if (open) {
        open = false;
        openIndex = -1;
      } else {
        open = true;
        openIndex = match.index;
      }
    }
    if (open && openIndex !== -1) {
      return { display: text.slice(0, openIndex), loading: true } as const;
    }
    return { display: text, loading: false } as const;
  };

  const getMemoryPrompt = useCallback(async () => {
    const memoryActive = Storage.get('vivica-memory-active', false);
    if (!memoryActive) return '';

    const profileId = Storage.get(STORAGE_KEYS.CURRENT_PROFILE, '');
    const memoryKeyPrefix = 'vivica-memory';
    const memoryScopeRaw = Storage.get('vivica-memory-scope', 'profile') as string;
    const includeProfile = memoryScopeRaw === 'profile';

    const getValidatedMemory = (key: string): StoredMemoryShape | null => {
      try {
        const memory = Storage.get(key, null);
        return memory && typeof memory === 'object' ? (memory as StoredMemoryShape) : null;
      } catch {
        return null;
      }
    };

    const globalMem = getValidatedMemory(`${memoryKeyPrefix}-global`);
    const profileMem = includeProfile && profileId
      ? getValidatedMemory(`${memoryKeyPrefix}-profile-${profileId}`)
      : null;

    const pickValue = (profileValue?: string, globalValue?: string) =>
      includeProfile && profileValue ? profileValue : globalValue;

    let prompt = '';
    const name = pickValue(profileMem?.identity?.name, globalMem?.identity?.name);
    if (name) prompt += `The user's name is ${name}. `;
    const pronouns = pickValue(profileMem?.identity?.pronouns, globalMem?.identity?.pronouns);
    if (pronouns) prompt += `Use ${pronouns} pronouns when referring to the user. `;
    const occupation = pickValue(profileMem?.identity?.occupation, globalMem?.identity?.occupation);
    if (occupation) prompt += `The user works as ${occupation}. `;
    const location = pickValue(profileMem?.identity?.location, globalMem?.identity?.location);
    if (location) prompt += `The user is located in ${location}. `;
    const tone = pickValue(profileMem?.personality?.tone, globalMem?.personality?.tone);
    if (tone) prompt += `Adopt a ${tone} tone when responding. `;
    const style = pickValue(profileMem?.personality?.style, globalMem?.personality?.style);
    if (style) prompt += `Use a ${style} communication style. `;
    const interests = pickValue(profileMem?.personality?.interests, globalMem?.personality?.interests);
    if (interests) prompt += `The user is interested in: ${interests}. `;

    const processInstructions = (mem: StoredMemoryShape | null) => {
      let p = '';
      if (mem?.customInstructions) p += `${mem.customInstructions} `;
      if (mem?.systemNotes) p += `Additional notes: ${mem.systemNotes} `;
      return p;
    };

    prompt += processInstructions(globalMem);
    if (includeProfile) prompt += processInstructions(profileMem);

    try {
      const globalMems = await getMemories(undefined, 'global');
      const profileMems = includeProfile && profileId ? await getMemories(profileId, 'profile') : [];
      const combined = [...globalMems, ...profileMems];
      if (combined.length) {
        const seen = new Set<string>();
        const unique = combined.map(m => String(m.content).trim()).filter(content => {
          if (!content) return false;
          const key = content.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const list = unique.map(content => `- ${content}`).join('\n');
        prompt += `${prompt ? '\n\n' : ''}Stored Facts:\n${list}`;
      }
    } catch (e) {
      console.warn('Failed to load memories from DB', e);
    }

    return prompt.trim();
  }, []);

  const buildSystemPrompt = useCallback(async (profile: Profile) => {
    const profilePrompt = profile?.systemPrompt || 'You are a helpful AI assistant.';
    const memoryPrompt = await getMemoryPrompt();
    const settings = Storage.get('vivica-settings', { includeWeather: false, includeRss: false });

    let prompt = profilePrompt;
    if (memoryPrompt) prompt += `\n\nUser Context: ${memoryPrompt}`;
    if (settings.includeWeather) prompt += `\n\nCurrent Weather: ${await getPromptWeatherText()}`;

    if (settings.includeRss) {
      try {
        const headlines = await fetchRSSHeadlines();
        const list = headlines.slice(0, 5).map(h => `- ${h.title} (${h.source})`).join('\n');
        if (list) prompt += `\n\nCurrent Headlines:\n${list}`;
      } catch (e) {
        console.debug('Failed to fetch headlines', e);
      }
    }
    return prompt;
  }, [getMemoryPrompt]);

  const handleSendMessage = useCallback(async (content: string, currentProfile: Profile | null, baseConv?: Conversation) => {
    if (isTyping || !currentProfile) return;
    const conversation = baseConv || currentConversation;
    if (!conversation || !content.trim()) return;

    activeRequestAbortRef.current?.abort();
    const requestController = new AbortController();
    activeRequestAbortRef.current = requestController;
    activeSendIdRef.current += 1;
    const sendId = activeSendIdRef.current;
    const isActiveSend = () => isMountedRef.current && activeSendIdRef.current === sendId;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
      profileId: currentProfile.id,
    };

    let updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage],
      lastMessage: content.trim(),
      timestamp: new Date(),
      title: conversation.messages.length === 0 ?
        content.trim().substring(0, 30) + (content.trim().length > 30 ? '...' : '') :
        conversation.title,
    };

    setCurrentConversation(updatedConversation);
    setConversations(prev => prev.map(conv => conv.id === conversation.id ? updatedConversation : conv));
    setIsTyping(true);

    const apiKey = getPrimaryApiKey();
    if (!apiKey) {
      toast.error('Please set your OpenRouter API key in Settings.');
      setIsTyping(false);
      return;
    }

    try {
      const systemPrompt = await buildSystemPrompt(currentProfile);
      if (!isActiveSend()) return;

      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...updatedConversation.messages.map(m => ({ role: m.role, content: m.content } as ChatMessage))
      ];

      const chatService = new ChatService(apiKey);
      const isCodeReq = /```|\bcode\b|function|programming/i.test(content);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        profileId: currentProfile.id,
        codeLoading: false,
      };

      updatedConversation = {
        ...updatedConversation,
        messages: [...updatedConversation.messages, assistantMessage],
        lastMessage: '',
        timestamp: new Date(),
      };

      setCurrentConversation(updatedConversation);
      setConversations(prev => prev.map(conv => conv.id === conversation.id ? updatedConversation : conv));

      const chatReq = {
        model: currentProfile.model,
        messages: chatMessages,
        temperature: currentProfile.temperature,
        max_tokens: currentProfile.maxTokens,
        stream: true,
        isCodeRequest: isCodeReq,
        profile: {
          model: currentProfile.model,
          codeModel: currentProfile.codeModel || currentProfile.model,
          fallbackModel: currentProfile.fallbackModel,
          temperature: currentProfile.temperature,
          maxTokens: currentProfile.maxTokens,
        },
        signal: requestController.signal,
      };

      const response = await chatService.sendMessage(chatReq);

      if (!isActiveSend()) return;

      let fullContent = '';
      let isCodeResp = false;
      for await (const chunk of chatService.streamResponse(response, chatReq)) {
        if (!isActiveSend()) return;
        if (typeof chunk === 'object' && 'type' in chunk) {
          if (chunk.type === 'stream_start') isCodeResp = !!chunk.data.isCodeRequest;
          continue;
        }
        const token = typeof chunk === 'string' ? chunk : chunk.content;
        fullContent += token;
        const parsed = parseStreamingContent(fullContent);

        const updateFn = (prev: Conversation | null) => {
            if (!prev) return prev;
            const msgs = prev.messages.map(msg =>
              msg.id === assistantMessage.id ? {
                ...msg,
                content: parsed.display,
                isCodeResponse: isCodeResp,
                codeLoading: parsed.loading,
              } : msg
            );
            return { ...prev, messages: msgs, lastMessage: parsed.display, timestamp: new Date() };
        };
        setCurrentConversation(updateFn);
        setConversations(p => p.map(c => c.id === conversation.id ? updateFn(c) as Conversation : c));
      }
    } catch (err) {
      if (!isActiveSend()) return;
      console.error(err);
      toast.error('Failed to send message.');
    } finally {
      if (isActiveSend()) setIsTyping(false);
    }
  }, [buildSystemPrompt, currentConversation, setCurrentConversation, setConversations, isTyping]);

  return { isTyping, handleSendMessage, activeRequestAbortRef };
}
