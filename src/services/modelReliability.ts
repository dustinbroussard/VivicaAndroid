import type { OpenRouterErrorType } from '@/services/chatService';

export interface ModelAttemptRecord {
  model: string;
  provider?: string;
  timestamp: number;
  success: boolean;
  errorType?: OpenRouterErrorType;
  responseMs?: number;
}

export interface ModelReliabilitySummary {
  score: number;
  label: 'Reliable lately' | 'Mixed lately' | 'Rate-limited lately' | 'Flaky' | 'Unavailable lately' | 'No data yet';
  attempts: number;
}

const STORAGE_KEY = 'vivica-model-attempts';
const MAX_TOTAL_ATTEMPTS = 400;
const LOOKBACK_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function loadAttempts(): ModelAttemptRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ModelAttemptRecord => {
      return !!item && typeof item.model === 'string' && typeof item.timestamp === 'number' && typeof item.success === 'boolean';
    });
  } catch {
    return [];
  }
}

function saveAttempts(items: ModelAttemptRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_TOTAL_ATTEMPTS)));
}

export function recordModelAttempt(attempt: ModelAttemptRecord) {
  const items = loadAttempts();
  items.push(attempt);
  saveAttempts(items);
}

export function getRecentModelAttempts(model: string): ModelAttemptRecord[] {
  const cutoff = Date.now() - LOOKBACK_MS;
  return loadAttempts()
    .filter(item => item.model === model && item.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function decayWeight(timestamp: number): number {
  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / 7);
}

export function getModelReliabilityScore(model: string): number {
  const attempts = getRecentModelAttempts(model).slice(0, 60);
  if (attempts.length === 0) return 50;

  let score = 50;

  for (const attempt of attempts) {
    const weight = decayWeight(attempt.timestamp);

    if (attempt.success) {
      score += 8 * weight;
      if (typeof attempt.responseMs === 'number' && attempt.responseMs > 2200) {
        const latencyPenalty = Math.min(4, (attempt.responseMs - 2200) / 1200);
        score -= latencyPenalty * weight;
      }
      continue;
    }

    switch (attempt.errorType) {
      case 'rate_limit':
        score -= 7 * weight;
        break;
      case 'network':
        score -= 4 * weight;
        break;
      case 'privacy_policy':
        score -= 24 * weight;
        break;
      case 'invalid_model':
        score -= 28 * weight;
        break;
      case 'provider_rejection':
        score -= 10 * weight;
        break;
      case 'api_key':
        score -= 2 * weight;
        break;
      default:
        score -= 8 * weight;
        break;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getModelReliabilitySummary(model: string): ModelReliabilitySummary {
  const recent = getRecentModelAttempts(model).slice(0, 30);
  if (recent.length === 0) {
    return { score: 50, label: 'No data yet', attempts: 0 };
  }

  const score = getModelReliabilityScore(model);

  const hardUnavailable = recent.filter(item => !item.success && (item.errorType === 'privacy_policy' || item.errorType === 'invalid_model')).length;
  const rateLimited = recent.filter(item => !item.success && item.errorType === 'rate_limit').length;
  const failures = recent.filter(item => !item.success).length;

  let label: ModelReliabilitySummary['label'];
  if (hardUnavailable >= 2) {
    label = 'Unavailable lately';
  } else if (rateLimited >= 2 && rateLimited >= Math.ceil(recent.length / 3)) {
    label = 'Rate-limited lately';
  } else if (score >= 72) {
    label = 'Reliable lately';
  } else if (score >= 52 && failures < recent.length / 2) {
    label = 'Mixed lately';
  } else {
    label = 'Flaky';
  }

  return { score, label, attempts: recent.length };
}

export function orderModelsByReliability(models: string[]): string[] {
  return [...models].sort((a, b) => {
    const aScore = getModelReliabilityScore(a);
    const bScore = getModelReliabilityScore(b);
    return bScore - aScore;
  });
}
