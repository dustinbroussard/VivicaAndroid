
import { useState, useEffect } from "react";
import { X, AlertTriangle, Key, Save, Trash } from "lucide-react";
import { STORAGE_KEYS } from "@/utils/storage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ThemeSelector } from "./ThemeSelector";
import { ApiKeyInput } from "./ApiKeyInput";
import { DEFAULT_RSS_FEEDS } from "@/utils/constants";
import { clearAllConversationsFromDb } from "@/utils/indexedDb";
import { exportJsonFile } from "@/utils/export";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [settings, setSettings] = useState({
    apiKey1: '',
    apiKey2: '',
    apiKey3: '',
    braveApiKey: localStorage.getItem('braveApiKey') || '',
    rssFeeds: DEFAULT_RSS_FEEDS.join(', '),
    includeWeather: false,
    includeRss: false,
  });

  useEffect(() => {
    // Load settings from localStorage when modal opens
    if (isOpen) {
      const savedSettings = localStorage.getItem('vivica-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error('Failed to parse saved settings:', error);
        }
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem('vivica-settings', JSON.stringify(settings));
    // Store Brave API key separately for easy access
    localStorage.setItem('braveApiKey', settings.braveApiKey);
    toast.success("Settings saved successfully!");
    onClose();
  };

  const handleClearAllConversations = async () => {
    if (confirm("Are you sure you want to clear all conversations? This action cannot be undone.")) {
      await clearAllConversationsFromDb();
      localStorage.removeItem('vivica-conversations');
      localStorage.removeItem('vivica-current-conversation');
      toast.success("All conversations cleared");
      window.location.reload();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <ApiKeyInput onApiKeyChange={() => {}} />

          {/* API Keys Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              <Label className="text-base font-semibold">API Keys</Label>
            </div>
            <div className="space-y-3">
              <Label>Brave Search API Key</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Brave API Key"
                  value={settings.braveApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, braveApiKey: e.target.value }))}
                  className="flex-1"
                />
                {settings.braveApiKey !== localStorage.getItem('braveApiKey') && (
                  <Button 
                    onClick={() => {
                      localStorage.setItem('braveApiKey', settings.braveApiKey);
                      toast.success("Brave API Key saved!");
                    }}
                    variant="outline"
                  >
                    Save
                  </Button>
                )}
              </div>
              {!settings.braveApiKey && (
                <p className="text-sm text-yellow-500">
                  Web search will be disabled until a Brave API key is provided
                </p>
              )}
            </div>
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="Primary API Key"
                value={settings.apiKey1}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey1: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="Secondary API Key (Optional)"
                value={settings.apiKey2}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey2: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="Tertiary API Key (Optional)"
                value={settings.apiKey3}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey3: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">Your API keys are stored locally and never shared</p>
            </div>
          </div>

          {/* RSS Feeds Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Custom RSS Feeds</Label>
            <Textarea
              placeholder="https://example.com/feed1, https://feed2.com/rss"
              value={settings.rssFeeds}
              onChange={(e) => setSettings(prev => ({ ...prev, rssFeeds: e.target.value }))}
              rows={3}
            />
            <p className="text-sm text-muted-foreground">Comma separated list of feeds</p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-weather"
                checked={settings.includeWeather}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, includeWeather: checked as boolean }))
                }
              />
              <Label htmlFor="include-weather">Include Weather in context</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-rss"
                checked={settings.includeRss}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, includeRss: checked as boolean }))
                }
              />
              <Label htmlFor="include-rss">Include RSS feeds in context</Label>
            </div>
          </div>

          {/* Theme Section */}
          <ThemeSelector />

          {/* Backup/Restore */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold">Backup & Restore</Label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const data: Record<string, unknown> = {};
                    Object.values(STORAGE_KEYS).forEach(key => {
                      const value = localStorage.getItem(key);
                      if (value) {
                        try {
                          data[key] = JSON.parse(value);
                        } catch {
                          data[key] = value;
                        }
                      }
                    });
                    const filename = `vivica-backup-${new Date().toISOString().split('T')[0]}.json`;
                    await exportJsonFile(filename, data);
                    toast.success('Backup created successfully!');
                  } catch (err) {
                    console.error('Backup failed:', err);
                    toast.error('Failed to create backup');
                  }
                }}
              >
                Backup Everything
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const contents = event.target?.result as string;
                        const data = JSON.parse(contents);
                        if (typeof data === 'object' && data !== null) {
                          Object.entries(data).forEach(([key, value]) => {
                            if (Object.values(STORAGE_KEYS).includes(key as string)) {
                              localStorage.setItem(key, JSON.stringify(value));
                            }
                          });
                          toast.success('Backup restored successfully!');
                          setTimeout(() => window.location.reload(), 1000);
                        }
                      } catch (err) {
                        toast.error('Invalid backup file');
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
              >
                Restore Backup
              </Button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <Label className="text-base font-semibold">Danger Zone</Label>
            </div>
            <Button
              variant="destructive"
              onClick={handleClearAllConversations}
              className="w-full"
            >
              <Trash className="w-4 h-4 mr-2" />
              Clear All Conversations
            </Button>
            <p className="text-sm text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
