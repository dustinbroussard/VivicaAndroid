import { useState, useEffect, useCallback } from 'react';
import { Storage, STORAGE_KEYS } from '@/utils/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UseInstallPromptReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isVisible: boolean;
  showInstallPrompt: () => Promise<void>;
  dismissPrompt: () => void;
}

export const useInstallPrompt = (): UseInstallPromptReturn => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Check if app is already installed
  useEffect(() => {
    const checkInstalled = () => {
      // Check if running in standalone mode (installed as PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const nav = navigator as Navigator & { standalone?: boolean };
      const isIOSStandalone = isIOS && nav.standalone;
      
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkInstalled();
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);
    
    return () => mediaQuery.removeEventListener('change', checkInstalled);
  }, []);

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      const event = e as BeforeInstallPromptEvent;
      
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();
      
      // Store the event for later use
      setDeferredPrompt(event);
      
      // Check if we should show the install prompt
      const dismissed = Storage.get(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, false);
      const lastPrompt = Storage.get(STORAGE_KEYS.LAST_INSTALL_PROMPT, 0);
      const now = Date.now();
      const daysSinceLastPrompt = (now - lastPrompt) / (1000 * 60 * 60 * 24);
      
      // Show prompt if not dismissed permanently or if it's been more than 7 days
      if (!dismissed || daysSinceLastPrompt > 7) {
        setIsVisible(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      
      // Clear dismissal state since app is now installed
      Storage.remove(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const showInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice;
      
      // Record the interaction
      Storage.set(STORAGE_KEYS.LAST_INSTALL_PROMPT, Date.now());
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
        // Don't show again for a while if dismissed
        Storage.set(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, true);
      }
      
      setIsVisible(false);
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    setIsVisible(false);
    Storage.set(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, true);
    Storage.set(STORAGE_KEYS.LAST_INSTALL_PROMPT, Date.now());
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isVisible: isVisible && !isInstalled,
    showInstallPrompt,
    dismissPrompt
  };
};