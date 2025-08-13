import { useEffect, useState, useRef } from 'react';
import { Storage } from '@/utils/storage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchArticleText } from '@/services/rssService';
import { DEFAULT_RSS_FEED } from '@/utils/constants';

interface Headline {
  title: string;
  link: string;
  description?: string;
  source?: string;
}

const DEFAULT_FEED = DEFAULT_RSS_FEED;

// Fetch RSS feeds via a CORS proxy and return basic info for each item.
async function fetchRSSSummariesWithLinks(urls: string[]): Promise<Headline[]> {
  const parser = new DOMParser();
  const headlines: Headline[] = [];
  
  for (const url of urls) {
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
          headlines.push({
            title,
            link,
            description,
            source: domain
          });
        }
      }
    } catch (err) {
      console.debug('Failed to fetch RSS feed:', url, err);
      continue;
    }
  }
  return headlines.slice(0, 20); // Limit to 20 headlines
}

interface RSSWidgetProps {
  onSendMessage: (content: string) => void;
  onNewChat: () => void;
}

export const RSSWidget = ({ onSendMessage, onNewChat }: RSSWidgetProps) => {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [currentHeadline, setCurrentHeadline] = useState<Headline | null>(null);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opacity, setOpacity] = useState(1);
  const [injecting, setInjecting] = useState(false);

  useEffect(() => {
    const loadRSSFeeds = async () => {
      setLoading(true);
      setError('');
      const settings = Storage.get('vivica-settings', { rssFeeds: '' });

      const feeds = settings.rssFeeds
        ? settings.rssFeeds.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [DEFAULT_FEED];
      
      try {
        const fetchedHeadlines = await fetchRSSSummariesWithLinks(feeds);
        setHeadlines(fetchedHeadlines);
        
        if (fetchedHeadlines.length > 0) {
          setCurrentHeadline(fetchedHeadlines[0]);
        } else {
          setError('No headlines found');
        }
      } catch (err) {
        console.error('Failed to load RSS feeds:', err);
        setError('Failed to load news feed');
      } finally {
        setLoading(false);
      }
    };

    loadRSSFeeds();
  }, []);

  useEffect(() => {
    if (headlines.length <= 1) return;

    const interval = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % headlines.length);
        setCurrentHeadline(headlines[(currentIndex + 1) % headlines.length]);
        setOpacity(1);
      }, 350);
    }, 5000);

    return () => clearInterval(interval);
  }, [headlines, currentIndex]);

  if (loading) {
    return (
      <div className="p-4 rounded-lg bg-card/50 border border-border flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading news...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-card/50 border border-border text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!currentHeadline) {
    return null;
  }

  // When a headline is clicked we grab the full article, clean it up with
  // Readability, and send the resulting text as a system prompt.
  const handleHeadlineClick = async () => {
    if (!currentHeadline.link.startsWith('http')) {
      toast.warning('Invalid news link');
      return;
    }

    if (injecting) return;
    setInjecting(true);

    try {
      const article = await fetchArticleText(currentHeadline.link);
      const content = article || currentHeadline.description || '';
      const messageContent =
        `Read and summarize the following article. Highlight anything important, and add your own witty take:\n` +
        `Title: ${currentHeadline.title}\n` +
        `URL: ${currentHeadline.link}\n` +
        `Article:\n${content}`;

      onNewChat();
      onSendMessage(messageContent);
    } catch (err) {
      console.error('Failed to fetch article', err);
      const fallback = currentHeadline.description || 'Unable to fetch article.';
      const messageContent =
        `Read and summarize the following article. Highlight anything important, and add your own witty take:\n` +
        `Title: ${currentHeadline.title}\n` +
        `URL: ${currentHeadline.link}\n` +
        `Article:\n${fallback}`;
      onNewChat();
      onSendMessage(messageContent);
      toast.error('Failed to load full article, using summary.');
    }
    finally {
      setInjecting(false);
    }
  };

  return (
    <div className="group relative p-4 rounded-lg bg-card/50 border border-border hover:border-accent/30 transition-colors">
      <div className="text-sm transition-opacity duration-300" style={{ opacity }}>
        <Button
          variant="ghost"
          className="relative w-full h-auto p-0 text-foreground hover:text-accent justify-start gap-2"
          onClick={handleHeadlineClick}
          disabled={injecting}
          aria-busy={injecting}
        >
          <span className={cn(injecting && 'opacity-0', 'flex items-center gap-2 w-full')}
            aria-hidden={injecting}
          >
            <span className="shrink-0">📰</span>
            <span className="truncate text-left">{currentHeadline.title}</span>
            {currentHeadline.link.startsWith('http') && (
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-70 ml-auto" />
            )}
          </span>
          {injecting && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-md" aria-hidden="true">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
            </span>
          )}
          <span className="sr-only">
            {injecting ? 'Injecting headline…' : 'Inject RSS headline'}
          </span>
        </Button>
      </div>
    </div>
  );
};
