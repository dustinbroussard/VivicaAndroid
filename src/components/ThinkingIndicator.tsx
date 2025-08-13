import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

export function ThinkingIndicator({ className }: { className?: string }) {
  const { variant } = useTheme();
  const bgClass = variant === 'dark' ? 'bg-muted' : 'bg-primary/20';
  const barClass = variant === 'dark' ? 'bg-accent' : 'bg-primary';

  return (
    <div className={cn("h-1 w-full overflow-hidden rounded relative", bgClass, className)}>
      <div className={cn("absolute inset-0 w-1/3 animate-indeterminate", barClass)} />
    </div>
  );
}
