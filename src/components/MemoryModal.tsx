
import { useState, useEffect } from "react";
import { Brain, Save, RotateCcw, FileDown, FileUp } from "lucide-react";
import { FaEdit, FaTrash } from "react-icons/fa";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getMemories, deleteMemory, editMemory, clearAllMemories } from "@/utils/memoryUtils";
import { saveMemoryToDb } from "@/utils/indexedDb";
import { exportJsonFile } from "@/utils/export";
import { STORAGE_KEYS } from "@/utils/storage";

interface MemoryData {
  scope: 'global' | 'profile';
  profileId?: string;
  identity: {
    name: string;
    pronouns: string;
    occupation: string;
    location: string;
  };
  personality: {
    tone: string;
    style: string;
    interests: string;
  };
  customInstructions: string;
  systemNotes: string;
  tags: string;
}

interface MemoryItem {
  id: string;
  content: string;
  scope: 'global' | 'profile';
  profileId?: string;
  createdAt: string;
  tags: string[];
}

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryModal = ({
  isOpen,
  onClose
}: MemoryModalProps) => {
  const currentProfileId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE) || '';
  const [memory, setMemory] = useState<MemoryData>({
    scope: 'profile',
    identity: {
      name: '',
      pronouns: '',
      occupation: '',
      location: '',
    },
    personality: {
      tone: '',
      style: '',
      interests: '',
    },
    customInstructions: '',
    systemNotes: '',
    tags: '',
  });

  const [isActive, setIsActive] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<'all'|'global'|'profile'>('all');
  const [memories, setMemories] = useState<MemoryItem[]>([]);

  useEffect(() => {
    const profileId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE) || '';
    const profileKey = profileId ? `vivica-memory-profile-${profileId}` : '';
    const profileMem = profileKey ? localStorage.getItem(profileKey) : null;
    const globalMem = localStorage.getItem('vivica-memory-global');
    const memoryActive = localStorage.getItem('vivica-memory-active');

    const stored = profileMem || globalMem;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMemory(prev => ({
          scope: parsed.scope === 'global' || parsed.scope === 'profile' ? parsed.scope : (profileMem ? 'profile' : 'global'),
          ...parsed,
        }));
      } catch {
        // ignore parse errors and keep defaults
      }
    }

    if (memoryActive !== null) {
      setIsActive(JSON.parse(memoryActive));
    }

    // Clean up legacy key from earlier versions
    localStorage.removeItem('vivica-memory');
  }, []);

  const handleDelete = async (entry: {id: string}) => {
    await deleteMemory(entry.id);
    setMemories(prev => prev.filter(m => m.id !== entry.id));
  };

  const handleEdit = async (entry: MemoryItem) => {
    const newContent = prompt('Edit memory', entry.content);
    if (newContent !== null && newContent.trim() !== '') {
      const updated = await editMemory(entry.id, newContent.trim());
      if (updated) {
        setMemories(prev => prev.map(m => m.id === entry.id ? updated : m));
      }
    }
  };

  // Load saved memory entries from IndexedDB when modal opens
  useEffect(() => {
    if (!isOpen) return;
    getMemories(currentProfileId, 'all').then(setMemories);
  }, [isOpen, currentProfileId]);

  const handleSave = () => {
    const profileId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE);
    const saveMemory = {
      ...memory,
      profileId: memory.scope === 'profile' ? profileId : undefined
    };

    const key = memory.scope === 'global'
      ? 'vivica-memory-global'
      : `vivica-memory-profile-${profileId}`;

    // Persist memory under the scoped key
    localStorage.setItem(key, JSON.stringify(saveMemory));
    localStorage.setItem('vivica-memory-active', JSON.stringify(isActive));
    
    toast.success(`Memory saved (${memory.scope} scope)!`);
    onClose();
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all memory data? This action cannot be undone.")) {
      const emptyMemory: MemoryData = {
        scope: 'profile',
        identity: { name: '', pronouns: '', occupation: '', location: '' },
        personality: { tone: '', style: '', interests: '' },
        customInstructions: '',
        systemNotes: '',
        tags: '',
      };
      setMemory(emptyMemory);
      // Remove all persisted memory keys for full reset
      const profileId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROFILE) || '';
      localStorage.removeItem('vivica-memory-global');
      if (profileId) localStorage.removeItem(`vivica-memory-profile-${profileId}`);
      localStorage.removeItem('vivica-memory');
      localStorage.removeItem('vivica-memory-active');
      clearAllMemories();
      toast.success("Memory data reset");
    }
  };

  const handleExport = async () => {
    const memoryEntries = await getMemories(currentProfileId, 'all');
    const exportData = { memory, memories: memoryEntries };
    await exportJsonFile('vivica-memory.json', exportData);
    toast.success("Memory exported successfully");
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          if (importedData.memory) {
            setMemory(importedData.memory);
          } else {
            setMemory(importedData);
          }
          if (Array.isArray(importedData.memories)) {
            for (const entry of importedData.memories) {
              await saveMemoryToDb(entry);
            }
            setMemories(importedData.memories);
          }
          toast.success("Memory imported successfully");
        } catch (error) {
          toast.error("Invalid file format");
        }
      };
      reader.readAsText(file);
    }
  };

  const generateSystemPrompt = () => {
    let prompt = "";
    
    if (memory.identity.name) {
      prompt += `The user's name is ${memory.identity.name}. `;
    }
    
    if (memory.identity.pronouns) {
      prompt += `Use ${memory.identity.pronouns} pronouns when referring to the user. `;
    }
    
    if (memory.identity.occupation) {
      prompt += `The user works as ${memory.identity.occupation}. `;
    }
    
    if (memory.identity.location) {
      prompt += `The user is located in ${memory.identity.location}. `;
    }
    
    if (memory.personality.tone) {
      prompt += `Adopt a ${memory.personality.tone} tone when responding. `;
    }
    
    if (memory.personality.style) {
      prompt += `Use a ${memory.personality.style} communication style. `;
    }
    
    if (memory.personality.interests) {
      prompt += `The user is interested in: ${memory.personality.interests}. `;
    }
    
    if (memory.customInstructions) {
      prompt += `${memory.customInstructions} `;
    }
    
    if (memory.systemNotes) {
      prompt += `Additional notes: ${memory.systemNotes}`;
    }
    
    return prompt.trim();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Memory Settings
            <div
              className={`ml-auto mr-6 text-xs px-2 py-1 rounded ${isActive ? 'bg-green-500/20 text-green-500' : 'bg-accent/20 text-accent'}`}
            >
              {isActive ? 'Active' : 'Inactive'}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Memory Scope (where to store this config) */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Memory Scope</Label>
            <div className="flex gap-2">
              <Button
                variant={memory.scope === 'global' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMemory(prev => ({ ...prev, scope: 'global' }))}
              >
                Global
              </Button>
              <Button
                variant={memory.scope === 'profile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMemory(prev => ({ ...prev, scope: 'profile' }))}
              >
                Current Profile
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Global memories apply to every persona. Profile memories only apply to the currently selected persona.
            </p>
          </div>

          {/* Memory Scope Filter */}
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Filter Memories</Label>
              <div className="flex gap-2">
                <Button
                  variant={scopeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScopeFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={scopeFilter === 'global' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScopeFilter('global')}
                >
                  Global
                </Button>
                <Button
                  variant={scopeFilter === 'profile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScopeFilter('profile')}
                >
                  Current Profile
                </Button>
              </div>
            </div>
            <div>
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="min-w-[100px]"
                onClick={() => setIsActive(!isActive)}
              >
                {isActive ? "Active" : "Inactive"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Identity Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Identity</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={memory.identity.name}
                  onChange={(e) => setMemory(prev => ({
                    ...prev,
                    identity: { ...prev.identity, name: e.target.value }
                  }))}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="pronouns">Pronouns</Label>
                <Input
                  id="pronouns"
                  value={memory.identity.pronouns}
                  onChange={(e) => setMemory(prev => ({
                    ...prev,
                    identity: { ...prev.identity, pronouns: e.target.value }
                  }))}
                  placeholder="they/them, she/her, he/him"
                />
              </div>
              <div>
                <Label htmlFor="occupation">Occupation</Label>
                <Input
                  id="occupation"
                  value={memory.identity.occupation}
                  onChange={(e) => setMemory(prev => ({
                    ...prev,
                    identity: { ...prev.identity, occupation: e.target.value }
                  }))}
                  placeholder="Software Developer"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={memory.identity.location}
                  onChange={(e) => setMemory(prev => ({
                    ...prev,
                    identity: { ...prev.identity, location: e.target.value }
                  }))}
                  placeholder="New York, USA"
                />
              </div>
            </div>
          </div>

          {/* Personality Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Personality & Tone</Label>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="tone">Preferred Tone</Label>
                <Input
                  id="tone"
                  value={memory.personality.tone}
                  onChange={(e) => setMemory(prev => ({
                    ...prev,
                    personality: { ...prev.personality, tone: e.target.value }
                  }))}
                  placeholder="friendly, professional, casual, formal"
                />
              </div>
              <div>
                <Label htmlFor="style">Communication Style</Label>
                <Input
                  id="style"
                  value={memory.personality.style}
                  onChange={(e) => setMemory(prev => ({
                    ...prev,
                    personality: { ...prev.personality, style: e.target.value }
                  }))}
                  placeholder="concise, detailed, creative, analytical"
                />
              </div>
              <div>
                <Label htmlFor="interests">Interests & Hobbies</Label>
                <Textarea
                  id="interests"
                  value={memory.personality.interests}
                  onChange={(e) => setMemory(prev => ({
                    ...prev,
                    personality: { ...prev.personality, interests: e.target.value }
                  }))}
                  placeholder="programming, music, cooking, travel..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Custom Instructions</Label>
            <Textarea
              value={memory.customInstructions}
              onChange={(e) => setMemory(prev => ({ ...prev, customInstructions: e.target.value }))}
              placeholder="Specific instructions for how the AI should behave..."
              rows={3}
            />
          </div>

          {/* System Notes */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">System Notes</Label>
            <Textarea
              value={memory.systemNotes}
              onChange={(e) => setMemory(prev => ({ ...prev, systemNotes: e.target.value }))}
              placeholder="Additional context or notes for the AI..."
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Tags</Label>
            <Input
              value={memory.tags}
              onChange={(e) => setMemory(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="work, personal, creative, technical"
            />
            <p className="text-sm text-muted-foreground">Comma-separated tags for organization</p>
          </div>

          {/* Generated Prompt Preview */}
          {generateSystemPrompt() && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Generated System Prompt Preview</Label>
              <div className="p-3 bg-muted/30 rounded-lg text-sm">
                {generateSystemPrompt()}
              </div>
            </div>
          )}

          {/* Memory List */}
          {memories?.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Saved Memories</Label>
              <div className="space-y-3">
                {memories.filter(entry => {
                  if (scopeFilter === 'all') return true;
                  if (scopeFilter === 'global') return entry.scope === 'global';
                  return entry.scope === 'profile' && entry.profileId === currentProfileId;
                }).map((entry) => (
                  <div key={entry.id} className="p-3 bg-muted/10 rounded-lg border border-border">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="text-sm whitespace-pre-line">
                          {
                            // Handle cases where content might be an object
                            typeof entry.content === 'string'
                              ? entry.content
                              : (console.log('Non-string memory entry', entry.content),
                                JSON.stringify(entry.content))
                          }
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            entry.scope === 'global' ? 'bg-blue-500' : 'bg-purple-500'
                          }`} title={entry.scope === 'global' ? 'Global memory' : 'Profile memory'}/>
                          {new Date(entry.createdAt).toLocaleString()}
                          {entry.tags?.length > 0 && (
                            <span className="ml-2">
                              {entry.tags.map(tag => `#${tag}`).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleEdit(entry)}
                        >
                          <FaEdit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete({ id: entry.id })}
                        >
                          <FaTrash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import/Export */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} size="sm">
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span>
                  <FileUp className="w-4 h-4 mr-2" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handleReset} className="text-destructive hover:text-destructive">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-accent hover:bg-accent/90">
            <Save className="w-4 h-4 mr-2" />
            Save Memory
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
