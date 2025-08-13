import { Loader2 } from "lucide-react";

export function CodeBlockLoader() {
  return (
    <div className="flex items-center justify-center py-8" role="status" aria-busy="true">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      <span className="sr-only">AI is generating code...</span>
    </div>
  );
}
