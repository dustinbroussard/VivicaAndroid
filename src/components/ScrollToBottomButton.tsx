import { ArrowDown } from "lucide-react";

interface ScrollToBottomButtonProps {
  /** Whether the button should be visible */
  visible: boolean;
  /** Called when the user clicks the button */
  onClick: () => void;
}

/**
 * Floating button shown when the chat is scrolled up and new messages arrive.
 * It fades in/out using Tailwind transitions and never intercepts clicks when
 * hidden. Clicking it smoothly scrolls to the latest message.
 */
export const ScrollToBottomButton = ({ visible, onClick }: ScrollToBottomButtonProps) => {
  return (
    <button
      aria-label="Scroll to latest message"
      onClick={onClick}
      className={`absolute right-4 bottom-24 z-10 p-2 rounded-full bg-background/70 text-foreground shadow-md hover:bg-background/90 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <ArrowDown className="w-5 h-5" />
    </button>
  );
};
