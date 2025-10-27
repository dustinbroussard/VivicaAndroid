
import { useState, useEffect } from "react";
import { X, User, Plus, Edit, Trash2, Palette, Sun, Moon } from "lucide-react";
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
import { ModelSelector } from "@/components/ModelSelector";
import { toast } from "sonner";
import { Storage } from "@/utils/storage";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ThemeColor, ThemeVariant } from "@/hooks/useTheme";
import { exportJsonFile } from "@/utils/export";

interface Profile {
  id: string;
  name: string;
  model: string;
  fallbackModel?: string;
  codeModel?: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  isVivica?: boolean;
   useProfileTheme?: boolean;
   themeColor?: ThemeColor;
   themeVariant?: ThemeVariant;
}

interface ProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfilesModal = ({ isOpen, onClose }: ProfilesModalProps) => {
  const [profiles, setProfiles] = useState<Profile[]>(JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]'));

  useEffect(() => {
    const handleProfileUpdate = () => {
      setProfiles(JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]'));
    };
    window.addEventListener('profilesUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profilesUpdated', handleProfileUpdate);
  }, []);

  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showForm, setShowForm] = useState(false);

  const themeOptions = [
    { value: 'default', label: 'Default', color: '#000000' },
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'red', label: 'Red', color: '#ef4444' },
    { value: 'green', label: 'Green', color: '#10b981' },
    { value: 'purple', label: 'Purple', color: '#8b5cf6' },
    { value: 'mardi-gras', label: 'Mardi Gras', color: '#7c3aed' },
  ];

  useEffect(() => {
    let list: Profile[] = [];
    try {
      list = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]');
    } catch (err) {
      console.error('Failed to parse profiles', err);
      list = [];
    }

    if (!list.some(p => p.isVivica)) {
      // Ensure the built-in Vivica profile always exists
      list.unshift(Storage.createVivicaProfile());
    }

    if (list.length === 0) {
      list = [
        Storage.createVivicaProfile(),
        {
          id: '2',
          name: 'Creative Writer',
          model: 'gpt-4',
          fallbackModel: 'meta-llama/llama-3.3-70b-instruct:free',
          systemPrompt:
            'You are a creative writing assistant specializing in storytelling and creative content.',
          temperature: 0.9,
          maxTokens: 3000,
          useProfileTheme: false,
          themeColor: 'default',
          themeVariant: 'dark',
        },
      ];
    }

    setProfiles(list);
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(list));
  }, []);

  const handleCreateProfile = () => {
    const newProfile: Profile = {
      id: Date.now().toString(),
      name: '',
      model: 'openai/gpt-3.5-turbo',
      fallbackModel: 'meta-llama/llama-3.3-70b-instruct:free',
      codeModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: 2000,
      useProfileTheme: false,
      themeColor: 'default',
      themeVariant: 'dark',
    };
    setEditingProfile(newProfile);
    setShowForm(true);
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile({ ...profile });
    setShowForm(true);
  };

  const persistProfiles = (list: Profile[]) => {
    setProfiles(list);
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(list));
    window.dispatchEvent(new Event('profilesUpdated'));
  };

  const handleSaveProfile = () => {
    if (!editingProfile) return;

    if (profiles.find(p => p.id === editingProfile.id)) {
      const updated = profiles.map(p =>
        p.id === editingProfile.id ? editingProfile : p
      );
      persistProfiles(updated);
      toast.success("Profile updated successfully!");
    } else {
      const updated = [...profiles, editingProfile];
      persistProfiles(updated);
      toast.success("Profile created successfully!");
    }

    setShowForm(false);
    setEditingProfile(null);
  };

  const handleDeleteProfile = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    // Hard-coded safeguard: Vivica stays in the list
    if (profile?.isVivica) {
      toast.error("Vivica cannot be deleted.");
      return;
    }

    if (confirm("Are you sure you want to delete this profile?")) {
      const updated = profiles.filter(p => p.id !== id);
      persistProfiles(updated);

      const current = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE);
      if (current === id) {
        if (updated.length > 0) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_PROFILE, updated[0].id);
        } else {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_PROFILE);
        }
      }

      toast.success("Profile deleted successfully!");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            AI Profiles
          </DialogTitle>
        </DialogHeader>

        {!showForm ? (
          // Profile List
          <div className="space-y-4 py-4">
            <div className="flex gap-2 w-full">
              <Button
                onClick={handleCreateProfile}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Profile
              </Button>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]');
                    const filename = `vivica-profiles-${new Date().toISOString().split('T')[0]}.json`;
                    await exportJsonFile(filename, profiles);
                    toast.success('Profiles exported successfully!');
                  } catch (err) {
                    console.error('Export failed:', err);
                    toast.error('Failed to export profiles');
                  }
                }}
              >
                Export
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
                        const profiles = JSON.parse(contents);
                        if (Array.isArray(profiles)) {
                          localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
                          // Notify the app so it can reload the active profile if needed
                          window.dispatchEvent(new Event('profilesUpdated'));
                          toast.success('Profiles imported successfully!');
                          // Refresh the profile list by re-triggering the useEffect
                          setProfiles(JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '[]'));
                        }
                      } catch (err) {
                        toast.error('Invalid profiles file');
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
              >
                Import
              </Button>
            </div>

            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 border border-border rounded-lg bg-background/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{profile.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Model: {profile.model}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {profile.systemPrompt}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Temp: {profile.temperature}</span>
                        <span>Max Tokens: {profile.maxTokens}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEditProfile(profile)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!profile.isVivica && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteProfile(profile.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Profile Form
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Profile Name</Label>
              <Input
                id="name"
                value={editingProfile?.name || ''}
                onChange={(e) =>
                  setEditingProfile(prev => prev ? { ...prev, name: e.target.value } : null)
                }
                placeholder="Enter profile name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <ModelSelector
                value={editingProfile?.model || ''}
                onValueChange={(value) =>
                  setEditingProfile(prev => prev ? { ...prev, model: value } : null)
                }
                placeholder="Select an AI model"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fallbackModel">Fallback Model (optional)</Label>
              <ModelSelector
                value={editingProfile?.fallbackModel || ''}
                onValueChange={(value) =>
                  setEditingProfile(prev => prev ? { ...prev, fallbackModel: value } : null)
                }
                placeholder="Select a fallback model (used if primary is unavailable)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codeModel">Coding Model</Label>
              <ModelSelector
                value={editingProfile?.codeModel || ''}
                onValueChange={(value) =>
                  setEditingProfile(prev => prev ? { ...prev, codeModel: value } : null)
                }
                placeholder="Select a coding model"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">System Prompt</Label>
              <Textarea
                id="prompt"
                value={editingProfile?.systemPrompt || ''}
                onChange={(e) =>
                  setEditingProfile(prev => prev ? { ...prev, systemPrompt: e.target.value } : null)
                }
                placeholder="Describe this AI's persona and role"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature: {editingProfile?.temperature || 0.7}
                </Label>
                <input
                  type="range"
                  id="temperature"
                  min="0"
                  max="1"
                  step="0.1"
                  value={editingProfile?.temperature || 0.7}
                  onChange={(e) =>
                    setEditingProfile(prev => prev ? { ...prev, temperature: parseFloat(e.target.value) } : null)
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tokens">Max Tokens</Label>
                <Input
                  id="tokens"
                  type="number"
                  min="100"
                  max="4000"
                  value={editingProfile?.maxTokens || 2000}
                  onChange={(e) =>
                    setEditingProfile(prev => prev ? { ...prev, maxTokens: parseInt(e.target.value) } : null)
                  }
                />
              </div>
            </div>

            {/* Theme Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useProfileTheme"
                  checked={editingProfile?.useProfileTheme || false}
                  onCheckedChange={(checked) =>
                    setEditingProfile(prev =>
                      prev
                        ? {
                            ...prev,
                            useProfileTheme: checked as boolean,
                            ...(checked
                              ? {
                                  themeColor: prev.themeColor || 'default',
                                  themeVariant: prev.themeVariant || 'dark',
                                }
                              : {}),
                          }
                        : null
                    )
                  }
                />
                <Label htmlFor="useProfileTheme">Use profile-specific theme</Label>
              </div>

              {editingProfile?.useProfileTheme && (
                <div className="space-y-4 pl-6">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    <Label className="text-base font-semibold">Theme</Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Color Scheme</Label>
                    <Select
                      value={editingProfile.themeColor || 'default'}
                      onValueChange={(value) =>
                        setEditingProfile(prev => prev ? { ...prev, themeColor: value as ThemeColor } : null)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose color scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        {themeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: option.color }}
                              />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Mode</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={editingProfile.themeVariant === 'dark' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setEditingProfile(prev => prev ? { ...prev, themeVariant: 'dark' } : null)
                        }
                        className="flex-1"
                      >
                        <Moon className="w-4 h-4 mr-2" />
                        Dark
                      </Button>
                      <Button
                        type="button"
                        variant={editingProfile.themeVariant === 'light' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setEditingProfile(prev => prev ? { ...prev, themeVariant: 'light' } : null)
                        }
                        className="flex-1"
                      >
                        <Sun className="w-4 h-4 mr-2" />
                        Light
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingProfile(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                className="flex-1 bg-accent hover:bg-accent/90"
                disabled={!editingProfile?.name.trim()}
              >
                Save Profile
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
