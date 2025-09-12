
import { toast } from "@/components/ui/sonner";
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  isCodeRequest?: boolean; // Flag for code requests
  tools?: Record<string, unknown>[];
  tool_choice?: 'auto' | 'none' | {name: string};
  profile?: {  // Include full profile for model routing
    model: string;
    codeModel: string;
    fallbackModel?: string;
    temperature: number;
    maxTokens: number;
  };
}

export interface StreamStart {
  type: 'stream_start';
  data: { isCodeRequest?: boolean };
}

export interface StreamContent {
  content: string;
  isCodeRequest?: boolean;
}

export class ChatService {
  /** Primary key used for OpenRouter requests */
  // TODO: allow setting multiple keys here instead of pulling from localStorage
  private apiKey: string;
  // apiKeyList is unused; keep until multi-key refactor
  private apiKeyList: string[];
  private baseUrl: string;
  private telemetry = {
    keyUsage: {} as Record<string, {success: number; failures: number; cooldownUntil?: number}>,
    lastUsedKey: '',
  };

  private static COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  // Remember the last working key across instances
  private static activeKey: string | null = null;
  // Track temporarily failing keys to avoid retrying them repeatedly
  private static keyCooldowns: Record<string, number> = {};

  constructor(apiKey?: string, apiUrl?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_API_KEY || '';
    this.apiKeyList = [];
    this.baseUrl = apiUrl || import.meta.env.VITE_API_URL || 'https://openrouter.ai/api/v1';
    this.initKeyTelemetry();
  }

  private initKeyTelemetry() {
    const saved = localStorage.getItem('vivica-key-telemetry');
    if (saved) {
      try {
        this.telemetry = JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to load key telemetry', e);
      }
    }
  }

  private saveKeyTelemetry() {
    localStorage.setItem(
      'vivica-key-telemetry', 
      JSON.stringify(this.telemetry)
    );
  }

  private trackKeyUsage(key: string, success: boolean) {
    const shortKey = key.slice(-4);
    if (!this.telemetry.keyUsage[shortKey]) {
      this.telemetry.keyUsage[shortKey] = { success: 0, failures: 0 };
    }

    const usage = this.telemetry.keyUsage[shortKey];

    if (success) {
      usage.success++;
      usage.cooldownUntil = undefined;
      this.telemetry.lastUsedKey = shortKey;
    } else {
      usage.failures++;
      usage.cooldownUntil = Date.now() + ChatService.COOLDOWN_MS;
    }

    this.saveKeyTelemetry();
  }

  private isKeyInCooldown(key: string): boolean {
    const shortKey = key.slice(-4);
    const usage = this.telemetry.keyUsage[shortKey];
    return !!(usage?.cooldownUntil && usage.cooldownUntil > Date.now());
  }

  private static loadActiveKey(): string | null {
    if (ChatService.activeKey !== null) return ChatService.activeKey;
    const saved = localStorage.getItem('vivica-active-api-key');
    ChatService.activeKey = saved || null;
    return ChatService.activeKey;
  }

  private static setActiveKey(key: string) {
    ChatService.activeKey = key;
    localStorage.setItem('vivica-active-api-key', key);
  }

  private static loadCooldowns() {
    if (Object.keys(ChatService.keyCooldowns).length > 0) return;
    const saved = localStorage.getItem('vivica-key-cooldowns');
    if (saved) {
      try {
        ChatService.keyCooldowns = JSON.parse(saved);
      } catch {
        ChatService.keyCooldowns = {};
      }
    }
  }

  private static saveCooldowns() {
    localStorage.setItem('vivica-key-cooldowns', JSON.stringify(ChatService.keyCooldowns));
  }

  private static setCooldown(key: string, ms = 5 * 60 * 1000) {
    ChatService.loadCooldowns();
    ChatService.keyCooldowns[key] = Date.now() + ms;
    ChatService.saveCooldowns();
  }

  private static isInCooldown(key: string): boolean {
    ChatService.loadCooldowns();
    const expiry = ChatService.keyCooldowns[key];
    if (!expiry) return false;
    if (Date.now() > expiry) {
      delete ChatService.keyCooldowns[key];
      ChatService.saveCooldowns();
      return false;
    }
    return true;
  }

  private static clearCooldown(key: string) {
    ChatService.loadCooldowns();
    if (ChatService.keyCooldowns[key]) {
      delete ChatService.keyCooldowns[key];
      ChatService.saveCooldowns();
    }
  }

  private async trySendWithKey(request: ChatRequest, apiKey: string): Promise<Response> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Vivica Chat Companion'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return response;
    } catch (error) {
      console.warn(`Attempt with key ${apiKey?.slice(-4)} failed:`, error);
      throw error;
    }
  }

  private isCodeRequest(messages: ChatMessage[]): boolean {
    // Check if last message contains code-related keywords or backticks
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
    return lastMessage.includes('code') || 
           lastMessage.includes('function') ||
           lastMessage.includes('```') ||
           lastMessage.includes('programming');
  }

  async sendMessage(request: ChatRequest): Promise<Response> {
    // Route to code model if this is a code request
    const isCode = request.isCodeRequest ?? this.isCodeRequest(request.messages);
    const primaryModel = isCode && request.profile?.codeModel
      ? request.profile.codeModel
      : request.model;

    const fallbackModel = request.profile?.fallbackModel && request.profile.fallbackModel !== primaryModel
      ? request.profile.fallbackModel
      : undefined;

    const attemptWithModel = async (modelId: string): Promise<Response> => {
      const sendReq: ChatRequest = { ...request, model: modelId };

      console.log('Sending request to OpenRouter:', {
        url: `${this.baseUrl}/chat/completions`,
        request: {
          ...sendReq,
          isCodeRequest: isCode
        }
      });

      // Get all API keys from storage - constructor key first, then settings keys
      const settings = JSON.parse(localStorage.getItem('vivica-settings') || '{}');
      const keys = Array.from(new Set([
        this.apiKey,
        settings.apiKey1 || '',
        settings.apiKey2 || '',
        settings.apiKey3 || ''
      ]
        .map((k: string) => k.trim())
        .filter(Boolean)))
        .filter(k => !ChatService.isInCooldown(k));

      if (keys.length === 0) {
        throw new Error('No valid API keys available. Please check your settings.');
      }

      // Remove keys that are currently in cooldown
      const usableKeys = keys.filter(k => !this.isKeyInCooldown(k));

      if (usableKeys.length === 0) {
        throw new Error('All API keys are temporarily disabled after recent failures.');
      }

      let lastError: Error | null = null;
      const showRetryFeedback = usableKeys.length > 1;

      const active = ChatService.loadActiveKey();
      let startIndex = active ? usableKeys.indexOf(active) : -1;
      if (startIndex === -1) {
        startIndex = usableKeys.indexOf(this.apiKey);
        if (startIndex === -1) startIndex = 0;
      }
      const rotate = (i: number) => (startIndex + i) % usableKeys.length;

      for (let attempt = 0; attempt < usableKeys.length; attempt++) {
        const idx = rotate(attempt);
        const key = usableKeys[idx].trim();
        try {
          if (attempt > 0 && showRetryFeedback) {
            toast.message(`Connecting with backup key ${attempt + 1}...`, {
              duration: 1000,
              position: 'bottom-center'
            });
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          const response = await this.trySendWithKey(sendReq, key);
          this.trackKeyUsage(key, true);
          ChatService.setActiveKey(key);
          ChatService.clearCooldown(key);

          if (attempt > 0) {
            if (showRetryFeedback) {
              toast.success(`Connected with backup key`, { duration: 2000, position: 'bottom-center' });
            } else {
              console.log(`Connected with backup key ${key.slice(-4)}`);
            }
            const backoff = Math.min(1000 * Math.pow(2, attempt), 8000);
            console.debug(`API request succeeded after ${attempt} retries (next backoff: ${backoff}ms)`);
          }

          return response;
        } catch (error) {
          const err = error as Error;
          const msg = err.message.toLowerCase();
          if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('rate limit') || msg.includes('429')) {
            this.trackKeyUsage(key, false);
            ChatService.setCooldown(key);
          } else {
            console.warn(`Transient error with key ${key.slice(-4)}:`, err);
          }
          lastError = err;
          if (attempt === usableKeys.length - 1) break;
        }
      }

      const errorMsg = lastError?.message.includes('401')
        ? 'Invalid API key(s). Please check your settings.'
        : lastError?.message.includes('rate limit')
        ? 'Rate limits exceeded on all keys. Please upgrade your plan or try again later.'
        : 'All API key attempts failed. Please check your connection and keys.';
      console.error('OpenRouter API failed after all attempts:', errorMsg);
      throw new Error(errorMsg);
    };

    try {
      return await attemptWithModel(primaryModel);
    } catch (e) {
      if (fallbackModel) {
        toast.message(`Primary model unavailable. Falling back to ${fallbackModel}`, { position: 'bottom-center' });
        return await attemptWithModel(fallbackModel);
      }
      throw e;
    }
  }

  async sendMessageJson<T = unknown>(request: ChatRequest): Promise<T> {
    const resp = await this.sendMessage({ ...request, stream: false });
    return resp.json();
  }


  async *streamResponse(
    response: Response,
    request?: ChatRequest
  ): AsyncGenerator<string | StreamStart | StreamContent, void, unknown> {
    // Yield a signal before starting the stream
    const startSignal: StreamStart = {
      type: 'stream_start',
      data: { isCodeRequest: request?.isCodeRequest }
    };
    yield startSignal;
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                // If this was a code request, we'll need to send the result to Vivica for summary
                // TODO: route the final code output back through the persona model
                // for a plain-English explanation before displaying to the user.
                yield {
                  content,
                  isCodeRequest: request?.isCodeRequest
                };
              }
            } catch (e) {
              console.warn('Failed to parse streaming response:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
