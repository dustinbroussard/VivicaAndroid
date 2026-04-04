
import React, { useState, useRef, Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatBody } from "@/components/ChatBody";
import { ChatFooter } from "@/components/ChatFooter";
import { ScrollToBottomButton } from "@/components/ScrollToBottomButton";

const SettingsModal = React.lazy(() => import("@/components/SettingsModal").then(m => ({ default: m.SettingsModal })));
const ProfilesModal = React.lazy(() => import("@/components/ProfilesModal").then(m => ({ default: m.ProfilesModal })));
const MemoryModal = React.lazy(() => import("@/components/MemoryModal").then(m => ({ default: m.MemoryModal })));

import { useConversations } from "@/hooks/useConversations";
import { useProfiles } from "@/hooks/useProfiles";
import { useChat } from "@/hooks/useChat";
import { saveConversationMemory } from "@/utils/memoryUtils";
import { getPrimaryApiKey } from "@/utils/api";
import { toast } from "sonner";
import type { Message, Conversation } from "@/hooks/useConversations";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    setConversations,
    currentConversation,
    setCurrentConversation,
    handleNewChat,
    deleteConversation,
  } = useConversations();

  const {
    currentProfile,
    handleProfileChange,
  } = useProfiles();

  const { 
    isTyping, 
    handleSendMessage, 
    activeRequestAbortRef 
  } = useChat(currentConversation, setCurrentConversation, setConversations);

  const onNewChat = () => {
    activeRequestAbortRef.current?.abort();
    handleNewChat();
    setSidebarOpen(false);
  };

  const onSendMessage = (content: string) => {
    handleSendMessage(content, currentProfile);
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
  };

  const handleSaveSummary = async () => {
    if (!currentConversation || currentConversation.messages.length === 0 || !currentProfile) {
      toast.error("No conversation to summarize");
      return;
    }
    const apiKey = getPrimaryApiKey();
    if (!apiKey) {
      toast.error("API key required for summarization");
      return;
    }
    await saveConversationMemory(
      currentConversation.messages.map(m => ({ role: m.role, content: m.content })),
      currentProfile.model,
      apiKey,
      'global'
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden relative font-outfit">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        currentConversation={currentConversation}
        onSelectConversation={(conv) => {
          setCurrentConversation(conv as Conversation);
          setSidebarOpen(false);
        }}
        onDeleteConversation={deleteConversation}
        onRenameConversation={(id, title) => {
          setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
        }}
        onGenerateTitle={() => {
           toast.info("Title generation requested");
        }}
        onNewChat={onNewChat}
        onOpenSettings={() => setShowSettings(true)}
        onOpenProfiles={() => setShowProfiles(true)}
        onOpenMemory={() => setShowMemory(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen relative bg-chat-gradient">
        <ChatHeader
          onMenuToggle={() => setSidebarOpen(true)}
          currentTitle={currentConversation?.title || "Vivica"}
          currentProfile={currentProfile}
          onProfileChange={handleProfileChange}
          onOpenProfiles={() => setShowProfiles(true)}
          onSaveSummary={handleSaveSummary}
        />

        <ChatBody
          ref={chatBodyRef}
          conversation={currentConversation}
          currentProfile={currentProfile}
          isTyping={isTyping}
          onSendMessage={onSendMessage}
          onNewChat={onNewChat}
          onEditMessage={handleEditMessage}
          onScroll={(isAtBottom) => setShowScrollButton(!isAtBottom)}
        />

        <ChatFooter
          onSendMessage={onSendMessage}
          editingMessage={editingMessage?.content}
          isSending={isTyping}
        />

        <ScrollToBottomButton 
          visible={showScrollButton}
          onClick={() => {
            if (chatBodyRef.current) {
              chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
              setShowScrollButton(false);
            }
          }}
        />
      </div>

      <Suspense fallback={null}>
        {showSettings && (
          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
        {showProfiles && (
          <ProfilesModal
            isOpen={showProfiles}
            onClose={() => setShowProfiles(false)}
          />
        )}
        {showMemory && (
          <MemoryModal
            isOpen={showMemory}
            onClose={() => setShowMemory(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Index;
