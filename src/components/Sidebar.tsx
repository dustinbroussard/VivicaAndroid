import { useState } from "react";
import { X, Plus, Search, User, Brain, Settings, MoreVertical, Edit2, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage?: string;
  timestamp: Date;
  /** Indicates an AI-generated title */
  autoTitled?: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  /** Regenerate the conversation title via LLM */
  onGenerateTitle: (conversation: Conversation) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenProfiles: () => void;
  onOpenMemory: () => void;
}

export const Sidebar = ({
  isOpen,
  onClose,
  conversations,
  currentConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onGenerateTitle,
  onNewChat,
  onOpenSettings,
  onOpenProfiles,
  onOpenMemory,
}: SidebarProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingConversation, setRenamingConversation] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { color, variant } = useTheme();
  const logoSrc = `/logo-${color === 'ai-choice' ? 'default' : color}${variant}.png`;

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRename = (conversation: Conversation) => {
    setRenamingConversation(conversation);
    setNewTitle(conversation.title);
    setShowRenameDialog(true);
  };

  const handleSaveRename = () => {
    if (renamingConversation && newTitle.trim()) {
      onRenameConversation(renamingConversation.id, newTitle.trim());
      setShowRenameDialog(false);
      setRenamingConversation(null);
      setNewTitle("");
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed left-0 top-0 h-full w-80 bg-card border-r border-border z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static md:z-auto`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src={logoSrc} alt="Vivica" className="w-8 h-8" />
                <span className="font-semibold">Vivica</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Regenerate title"
                  disabled={!currentConversation}
                  onClick={() =>
                    currentConversation && onGenerateTitle(currentConversation)
                  }
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="md:hidden"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <Button
              onClick={onNewChat}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>

          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredConversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {searchTerm ? 'No conversations found' : 'No conversations yet'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                      currentConversation?.id === conversation.id
                        ? 'bg-accent/10 border border-accent/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onSelectConversation(conversation)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate text-sm">
                          {conversation.title}
                        </h3>
                        {conversation.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conversation.lastMessage}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(conversation.timestamp)}
                        </p>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRename(conversation)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onGenerateTitle(conversation)}>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Auto Title
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteConversation(conversation.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border space-y-2">
            <Button
              variant="ghost"
              onClick={onOpenProfiles}
              className="w-full justify-start"
            >
              <User className="w-4 h-4 mr-2" />
              Profiles
            </Button>
            <Button
              variant="ghost"
              onClick={onOpenMemory}
              className="w-full justify-start"
            >
              <Brain className="w-4 h-4 mr-2" />
              Memory
            </Button>
            <Button
              variant="ghost"
              onClick={onOpenSettings}
              className="w-full justify-start"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter conversation name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveRename();
                }
              }}
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRename}
              className="flex-1 bg-accent hover:bg-accent/90"
              disabled={!newTitle.trim()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
