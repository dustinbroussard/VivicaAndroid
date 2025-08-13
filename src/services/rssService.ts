// Readability gives us a clean article body from messy HTML pages.
import { Readability } from '@mozilla/readability';
import { DEFAULT_RSS_FEED } from '@/utils/constants';

export interface Headline {
  title: string;
  link: string;
  description?: string;
  source?: string;
}

const DEFAULT_FEED = DEFAULT_RSS_FEED;

export async function fetchRSSHeadlines(): Promise<Headline[]> {
  const parser = new DOMParser();
  const headlines: Headline[] = [];

  const settings = JSON.parse(localStorage.getItem('vivica-settings') || '{}');
  const feeds: string[] = settings.rssFeeds
    ? settings.rssFeeds.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [DEFAULT_FEED];

  for (const url of feeds) {
    try {
      const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      const data = await resp.text();
      if (!data) continue;

      const doc = parser.parseFromString(data, 'text/xml');
      const items = doc.querySelectorAll('item');
      const domain = new URL(url).hostname.replace('www.', '');

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
    } catch (err) {
      console.debug('Failed to fetch RSS feed:', url, err);
      continue;
    }
  }

  return headlines.slice(0, 10);
}

// Fetch the full article HTML via a CORS proxy and extract just the readable
// content using Mozilla's Readability algorithm.
export async function fetchArticleText(url: string): Promise<string> {
  const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  const html = await resp.text();

  // Parse the HTML string in a detached document to avoid leaking scripts/styles
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  const article = new Readability(doc).parse();
  if (article?.textContent) {
    return article.textContent.trim();
  }

  // Fallback to a simple text extraction if Readability fails
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}
