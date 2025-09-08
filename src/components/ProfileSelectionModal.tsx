
import { User, Settings, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ThemeColor, ThemeVariant } from "@/hooks/useTheme";

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

interface ProfileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  currentProfile: Profile | null;
  onProfileSelect: (profile: Profile) => void;
  onOpenProfiles: () => void;
}

export const ProfileSelectionModal = ({
  isOpen,
  onClose,
  profiles,
  currentProfile,
  onProfileSelect,
  onOpenProfiles
}: ProfileSelectionModalProps) => {
  const handleManageProfiles = () => {
    onClose();
    onOpenProfiles();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Select Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {profiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No profiles created yet</p>
              <Button onClick={handleManageProfiles} className="bg-accent hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Profile
              </Button>
            </div>
          ) : (
            <>
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent/5 ${
                    currentProfile?.id === profile.id 
                      ? 'border-accent bg-accent/10' 
                      : 'border-border bg-background/50'
                  }`}
                  onClick={() => onProfileSelect(profile)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{profile.name}</h3>
                        {currentProfile?.id === profile.id && (
                          <Badge variant="secondary" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {profile.model}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {profile.systemPrompt}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Temp: {profile.temperature}</span>
                        <span>Max Tokens: {profile.maxTokens}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="pb-4 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={handleManageProfiles}
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Profiles
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
