import { cn } from "@/lib/utils";

export function ThinkingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("h-1 w-full bg-muted overflow-hidden rounded relative", className)}>
      <div className="absolute inset-0 w-1/3 bg-accent animate-indeterminate" />
    </div>
  );
}
