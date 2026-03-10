
import { toast } from "@/components/ui/sonner";
import { orderModelsByReliability, recordModelAttempt } from "@/services/modelReliability";
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
  signal?: AbortSignal;
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

export type OpenRouterErrorType =
  | 'privacy_policy'
  | 'rate_limit'
  | 'invalid_model'
  | 'network'
  | 'api_key'
  | 'provider_rejection'
  | 'unknown';

export interface OpenRouterErrorInfo {
  type: OpenRouterErrorType;
  message: string;
  model?: string;
  provider?: string;
  retryable: boolean;
  status?: number;
  rawMessage?: string;
}

export class OpenRouterError extends Error {
  info: OpenRouterErrorInfo;

  constructor(info: OpenRouterErrorInfo) {
    super(info.message);
    this.name = 'OpenRouterError';
    this.info = info;
  }
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
  private static MAX_RETRIES_PER_KEY = 2;
  private static BACKOFF_BASE_MS = 700;
  private static BACKOFF_MAX_MS = 6000;

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

  private static sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static backoffForAttempt(attempt: number): number {
    const jitter = Math.floor(Math.random() * 200);
    return Math.min(ChatService.BACKOFF_BASE_MS * Math.pow(2, attempt), ChatService.BACKOFF_MAX_MS) + jitter;
  }

  private static devLog(message: string, meta?: Record<string, unknown>) {
    if (!import.meta.env.DEV) return;
    if (meta) {
      console.debug(`[OpenRouter] ${message}`, meta);
      return;
    }
    console.debug(`[OpenRouter] ${message}`);
  }

  private static normalizeProvider(provider?: string | null): string | undefined {
    if (!provider) return undefined;
    return provider.trim() || undefined;
  }

  private static getProviderFromHeaders(response: Response): string | undefined {
    const providerHeaders = [
      'x-openrouter-upstream-provider',
      'x-openrouter-provider',
      'x-provider',
      'openrouter-provider',
    ];

    for (const headerName of providerHeaders) {
      const value = response.headers.get(headerName);
      if (value) return ChatService.normalizeProvider(value);
    }

    return undefined;
  }

  private static parseErrorPayload(rawText: string): {
    rawMessage: string;
    provider?: string;
    code?: string;
  } {
    const fallback = { rawMessage: rawText };
    if (!rawText) return fallback;

    try {
      const parsed = JSON.parse(rawText);
      const err = parsed?.error ?? parsed;
      const rawMessage = String(
        err?.message ??
        parsed?.message ??
        rawText
      );
      const provider = err?.metadata?.provider_name || err?.provider || parsed?.provider;
      const code = err?.code || parsed?.code;
      return { rawMessage, provider, code };
    } catch {
      return fallback;
    }
  }

  private static classifyOpenRouterError(args: {
    status?: number;
    rawMessage?: string;
    model?: string;
    provider?: string;
    network?: boolean;
  }): OpenRouterErrorInfo {
    const status = args.status;
    const rawMessage = (args.rawMessage || '').trim();
    const msg = rawMessage.toLowerCase();
    const model = args.model;
    const provider = args.provider;

    if (args.network) {
      return {
        type: 'network',
        message: 'Network error while contacting OpenRouter. Please check your connection and try again.',
        model,
        provider,
        retryable: true,
        rawMessage,
      };
    }

    if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('bad api key')) {
      return {
        type: 'api_key',
        message: 'OpenRouter API key rejected. Please verify your API keys in Settings.',
        model,
        provider,
        retryable: false,
        status,
        rawMessage,
      };
    }

    if (
      msg.includes('data policy') ||
      msg.includes('privacy settings') ||
      msg.includes('publication') ||
      msg.includes('blocked by your data policy') ||
      msg.includes('no endpoints found matching your data policy')
    ) {
      return {
        type: 'privacy_policy',
        message: 'The selected model is blocked by your OpenRouter privacy settings.',
        model,
        provider,
        retryable: false,
        status,
        rawMessage,
      };
    }

    if (
      msg.includes('rate limit') ||
      msg.includes('temporarily rate limited') ||
      msg.includes('too many requests') ||
      status === 429
    ) {
      return {
        type: 'rate_limit',
        message: 'This model is temporarily rate limited. Try another model.',
        model,
        provider,
        retryable: true,
        status,
        rawMessage,
      };
    }

    if (
      (status === 404 || status === 400) &&
      (msg.includes('model') && (
        msg.includes('not found') ||
        msg.includes('no such model') ||
        msg.includes('invalid model') ||
        msg.includes('not available') ||
        msg.includes('does not exist') ||
        msg.includes('unknown model')
      ))
    ) {
      return {
        type: 'invalid_model',
        message: 'The selected model is no longer available.',
        model,
        provider,
        retryable: false,
        status,
        rawMessage,
      };
    }

    if (status !== undefined && status >= 500) {
      return {
        type: 'provider_rejection',
        message: 'OpenRouter provider is temporarily unavailable. Please try again.',
        model,
        provider,
        retryable: true,
        status,
        rawMessage,
      };
    }

    if (
      msg.includes('provider returned error') ||
      msg.includes('upstream') ||
      msg.includes('provider')
    ) {
      const retryable = status === 502 || status === 503 || status === 504 || msg.includes('temporarily');
      return {
        type: 'provider_rejection',
        message: retryable
          ? 'OpenRouter provider is temporarily unavailable. Please try again.'
          : 'The provider rejected this request for the selected model.',
        model,
        provider,
        retryable,
        status,
        rawMessage,
      };
    }

    return {
      type: 'unknown',
      message: 'OpenRouter request failed. Please try again.',
      model,
      provider,
      retryable: false,
      status,
      rawMessage,
    };
  }

  private async trySendWithKey(request: ChatRequest, apiKey: string): Promise<Response> {
    try {
      const { signal, ...payload } = request;
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Vivica Chat Companion'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        const payload = ChatService.parseErrorPayload(text);
        const info = ChatService.classifyOpenRouterError({
          status: response.status,
          rawMessage: payload.rawMessage,
          model: request.model,
          provider: payload.provider
        });
        throw new OpenRouterError(info);
      }
      return response;
    } catch (error) {
      if (error instanceof OpenRouterError) {
        throw error;
      }

      const err = error as Error;
      const msg = (err.message || '').toLowerCase();
      if (err.name === 'AbortError') {
        throw new OpenRouterError({
          type: 'network',
          message: 'Request cancelled.',
          model: request.model,
          retryable: false,
          rawMessage: err.message,
        });
      }
      const isNetworkError =
        err.name === 'TypeError' ||
        err.name === 'AbortError' ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed');

      const info = isNetworkError
        ? ChatService.classifyOpenRouterError({
            network: true,
            rawMessage: err.message,
            model: request.model
          })
        : ChatService.classifyOpenRouterError({
            rawMessage: err.message,
            model: request.model
          });

      throw new OpenRouterError(info);
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

    const fallbackCandidates: string[] = [];
    if (request.profile?.fallbackModel && request.profile.fallbackModel !== primaryModel) {
      fallbackCandidates.push(request.profile.fallbackModel);
    }
    // For code requests, include the profile base model as an additional fallback candidate.
    if (isCode && request.model !== primaryModel) {
      fallbackCandidates.push(request.model);
    }
    const uniqueFallbackCandidates = Array.from(new Set(fallbackCandidates));

    const attemptWithModel = async (modelId: string): Promise<Response> => {
      const sendReq: ChatRequest = { ...request, model: modelId };

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
        throw new OpenRouterError({
          type: 'api_key',
          message: 'No valid OpenRouter API keys available. Please check your settings.',
          model: modelId,
          retryable: false
        });
      }

      // Remove keys that are currently in cooldown
      const usableKeys = keys.filter(k => !this.isKeyInCooldown(k));

      if (usableKeys.length === 0) {
        throw new OpenRouterError({
          type: 'rate_limit',
          message: 'All configured API keys are temporarily rate limited. Please try again shortly.',
          model: modelId,
          retryable: true
        });
      }

      let lastError: OpenRouterError | null = null;
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
        const keyAttemptNumber = attempt + 1;
        ChatService.devLog('Attempting model request', {
          model: modelId,
          provider: 'unknown',
          attempt: `${keyAttemptNumber}/${usableKeys.length}`,
        });
        try {
          if (attempt > 0 && showRetryFeedback) {
            toast.message(`Connecting with backup key ${attempt + 1}...`, {
              duration: 1000,
              position: 'bottom-center'
            });
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          const startedAt = performance.now();
          const response = await this.trySendWithKey(sendReq, key);
          const elapsedMs = Math.round(performance.now() - startedAt);
          const provider = ChatService.getProviderFromHeaders(response);
          recordModelAttempt({
            model: modelId,
            provider,
            timestamp: Date.now(),
            success: true,
            responseMs: elapsedMs,
          });
          this.trackKeyUsage(key, true);
          ChatService.setActiveKey(key);
          ChatService.clearCooldown(key);
          ChatService.devLog('Model request succeeded', {
            model: modelId,
            provider: provider || 'unknown',
            attempt: `${keyAttemptNumber}/${usableKeys.length}`,
            responseMs: elapsedMs,
          });

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
          const err = error instanceof OpenRouterError
            ? error
            : new OpenRouterError(
                ChatService.classifyOpenRouterError({ rawMessage: String(error), model: modelId })
              );

          if (err.info.type === 'api_key' || err.info.type === 'rate_limit') {
            this.trackKeyUsage(key, false);
            ChatService.setCooldown(key);
          }

          lastError = err;
          recordModelAttempt({
            model: modelId,
            provider: err.info.provider,
            timestamp: Date.now(),
            success: false,
            errorType: err.info.type,
          });
          ChatService.devLog('Model request failed', {
            model: modelId,
            provider: err.info.provider || 'unknown',
            attempt: `${keyAttemptNumber}/${usableKeys.length}`,
            type: err.info.type,
            retryable: err.info.retryable,
          });

          // Do not keep rotating keys for model/policy/provider-hard-reject failures.
          if (
            err.info.type === 'privacy_policy' ||
            err.info.type === 'invalid_model' ||
            (err.info.type === 'provider_rejection' && !err.info.retryable)
          ) {
            break;
          }

          if (err.info.retryable) {
            for (let retryAttempt = 0; retryAttempt < ChatService.MAX_RETRIES_PER_KEY; retryAttempt++) {
              const delayMs = ChatService.backoffForAttempt(retryAttempt);
              ChatService.devLog('Retrying model request with backoff', {
                model: modelId,
                provider: err.info.provider || 'unknown',
                attempt: `${keyAttemptNumber}/${usableKeys.length}`,
                retryAttempt: retryAttempt + 1,
                backoffMs: delayMs,
                type: err.info.type,
              });
              await ChatService.sleep(delayMs);
              try {
                const retryStartedAt = performance.now();
                const retryResponse = await this.trySendWithKey(sendReq, key);
                const retryElapsedMs = Math.round(performance.now() - retryStartedAt);
                const retryProvider = ChatService.getProviderFromHeaders(retryResponse);
                recordModelAttempt({
                  model: modelId,
                  provider: retryProvider,
                  timestamp: Date.now(),
                  success: true,
                  responseMs: retryElapsedMs,
                });
                this.trackKeyUsage(key, true);
                ChatService.setActiveKey(key);
                ChatService.clearCooldown(key);
                ChatService.devLog('Model retry succeeded', {
                  model: modelId,
                  provider: retryProvider || 'unknown',
                  attempt: `${keyAttemptNumber}/${usableKeys.length}`,
                  retryAttempt: retryAttempt + 1,
                  responseMs: retryElapsedMs,
                });
                return retryResponse;
              } catch (retryError) {
                const classifiedRetryError = retryError instanceof OpenRouterError
                  ? retryError
                  : new OpenRouterError(
                      ChatService.classifyOpenRouterError({ rawMessage: String(retryError), model: modelId })
                    );
                lastError = classifiedRetryError;
                recordModelAttempt({
                  model: modelId,
                  provider: classifiedRetryError.info.provider,
                  timestamp: Date.now(),
                  success: false,
                  errorType: classifiedRetryError.info.type,
                });
                ChatService.devLog('Model retry failed', {
                  model: modelId,
                  provider: classifiedRetryError.info.provider || 'unknown',
                  attempt: `${keyAttemptNumber}/${usableKeys.length}`,
                  retryAttempt: retryAttempt + 1,
                  type: classifiedRetryError.info.type,
                  retryable: classifiedRetryError.info.retryable,
                });
                if (!classifiedRetryError.info.retryable) {
                  break;
                }
              }
            }
          }

          if (attempt === usableKeys.length - 1) break;
        }
      }

      const fallbackInfo: OpenRouterErrorInfo = lastError?.info ?? {
        type: 'unknown',
        message: 'OpenRouter request failed. Please try again.',
        model: modelId,
        retryable: false
      };
      console.error('OpenRouter API failed after all attempts:', fallbackInfo);
      throw new OpenRouterError(fallbackInfo);
    };

    try {
      return await attemptWithModel(primaryModel);
    } catch (primaryError) {
      let lastFallbackError: unknown = primaryError;
      if (uniqueFallbackCandidates.length > 0) {
        const orderedFallbacks = orderModelsByReliability(uniqueFallbackCandidates);
        ChatService.devLog('Primary model failed; selecting fallback', {
          model: primaryModel,
          fallbackCandidates: uniqueFallbackCandidates,
          orderedFallbacks,
          reason: primaryError instanceof OpenRouterError ? primaryError.info.type : 'unknown',
        });

        for (const fallbackModel of orderedFallbacks) {
          toast.message(`Primary model unavailable. Falling back to ${fallbackModel}`, { position: 'bottom-center' });
          ChatService.devLog('Attempting fallback model', {
            model: primaryModel,
            fallbackModel,
          });
          try {
            return await attemptWithModel(fallbackModel);
          } catch (fallbackError) {
            ChatService.devLog('Fallback model failed', {
              model: primaryModel,
              fallbackModel,
              type: fallbackError instanceof OpenRouterError ? fallbackError.info.type : 'unknown',
            });
            lastFallbackError = fallbackError;
          }
        }
      }
      throw lastFallbackError;
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
