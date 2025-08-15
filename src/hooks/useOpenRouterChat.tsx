
import { useState, useCallback } from 'react';
import { ChatService, ChatMessage } from '@/services/chatService';
import { getPrimaryApiKey } from '@/utils/api';

interface UseOpenRouterChatProps {
  apiKey?: string;
}

export const useOpenRouterChat = ({ apiKey }: UseOpenRouterChatProps = {}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    messages: ChatMessage[],
    model: string,
    temperature: number = 0.7,
    onToken: (token: string) => void,
    onComplete: () => void
  ) => {
    const key = apiKey || getPrimaryApiKey();
    if (!key) {
      setError('OpenRouter API key is required');
      return;
    }

    setIsStreaming(true);
    setError(null);

    try {
      const chatService = new ChatService(key);
      const response = await chatService.sendMessage({
        model,
        messages,
        temperature,
        max_tokens: 4000,
        stream: true
      });

      for await (const token of chatService.streamResponse(response)) {
        onToken(token);
      }

      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('OpenRouter API error:', err);
    } finally {
      setIsStreaming(false);
    }
  }, [apiKey]);

  return {
    sendMessage,
    isStreaming,
    error,
    clearError: () => setError(null)
  };
};
