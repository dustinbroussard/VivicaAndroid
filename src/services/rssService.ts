import { Readability } from '@mozilla/readability';
import { DEFAULT_RSS_FEEDS } from '@/utils/constants';

export interface Headline {
  title: string;
  link: string;
  description?: string;
  source?: string;
}

interface FetchRSSHeadlinesOptions {
  feeds?: string[];
  limit?: number;
}

const DEFAULT_FEEDS = DEFAULT_RSS_FEEDS;
const DEV_RSS_PROXY_PATH = '/api/rss-proxy';
const FETCH_TIMEOUT_MS = 12000;
const loggedFailures = new Set<string>();

function getConfiguredProxyUrl(targetUrl: string): string | null {
  const template = import.meta.env.VITE_RSS_PROXY_URL?.trim();
  if (!template) return null;

  if (template.includes('{url}')) {
    return template.replace('{url}', encodeURIComponent(targetUrl));
  }

  const joiner = template.includes('?') ? '&' : '?';
  return `${template}${joiner}url=${encodeURIComponent(targetUrl)}`;
}

function getFetchCandidates(targetUrl: string): string[] {
  const candidates: string[] = [];

  // In local dev, Vite serves a same-origin relay to bypass browser CORS limits.
  if (import.meta.env.DEV) {
    candidates.push(`${DEV_RSS_PROXY_PATH}?url=${encodeURIComponent(targetUrl)}`);
  }

  const configuredProxy = getConfiguredProxyUrl(targetUrl);
  if (configuredProxy) {
    candidates.push(configuredProxy);
  }

  // Final fallback: direct request for feeds that already allow CORS.
  candidates.push(targetUrl);

  return [...new Set(candidates)];
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.text();
    if (!data.trim()) {
      throw new Error('Empty response body');
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithFallback(targetUrl: string): Promise<string> {
  const attempts = getFetchCandidates(targetUrl);
  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      return await fetchText(attempt);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(failures[failures.length - 1] || 'Unable to fetch URL');
}

function parseFeedXml(xml: string, feedUrl: string): Headline[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) {
    return [];
  }

  const items = doc.querySelectorAll('item');
  const domain = new URL(feedUrl).hostname.replace('www.', '');
  const headlines: Headline[] = [];

  for (const item of items) {
    const title = item.querySelector('title')?.textContent?.trim();
    const link = item.querySelector('link')?.textContent?.trim();
    const descNode = item.querySelector('description');
    const contentNode = item.querySelector('content\\:encoded');
    let description = contentNode?.textContent || descNode?.textContent || '';
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (title && link) {
      headlines.push({ title, link, source: domain, description });
    }
  }

  return headlines;
}

function logFailureOnce(kind: 'feed' | 'article', url: string, error: unknown): void {
  if (!import.meta.env.DEV) return;

  const key = `${kind}:${url}`;
  if (loggedFailures.has(key)) return;
  loggedFailures.add(key);

  console.warn(`Failed to load ${kind} URL once: ${url}`, error);
}

async function collectHeadlines(feeds: string[]): Promise<Headline[]> {
  const headlines: Headline[] = [];

  for (const url of feeds) {
    try {
      const xml = await fetchTextWithFallback(url);
      headlines.push(...parseFeedXml(xml, url));
    } catch (error) {
      logFailureOnce('feed', url, error);
    }
  }

  return headlines;
}

export async function fetchRSSHeadlines(options: FetchRSSHeadlinesOptions = {}): Promise<Headline[]> {
  const settings = JSON.parse(localStorage.getItem('vivica-settings') || '{}');
  const userFeeds: string[] = settings.rssFeeds
    ? settings.rssFeeds.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const requestedFeeds = options.feeds?.length
    ? options.feeds
    : (userFeeds.length ? userFeeds : DEFAULT_FEEDS);

  let headlines = await collectHeadlines(requestedFeeds);

  // If custom feeds are configured but all failed, try known defaults once.
  if (headlines.length === 0 && userFeeds.length && !options.feeds?.length) {
    headlines = await collectHeadlines(DEFAULT_FEEDS);
  }

  return headlines.slice(0, options.limit ?? 10);
}

export async function fetchArticleText(url: string): Promise<string> {
  try {
    const html = await fetchTextWithFallback(url);

    // Parse in a detached document before Readability extraction.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());

    const article = new Readability(doc).parse();
    if (article?.textContent) {
      return article.textContent.trim();
    }

    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch (error) {
    logFailureOnce('article', url, error);
    throw error;
  }
}
