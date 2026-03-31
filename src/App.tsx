import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import InstallPrompt from "./components/InstallPrompt";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const queryClient = new QueryClient();

function getRouterBasename() {
  const configuredBase = import.meta.env.BASE_URL;

  if (configuredBase && configuredBase !== "/" && configuredBase !== "./") {
    return configuredBase.endsWith("/")
      ? configuredBase.slice(0, -1)
      : configuredBase;
  }

  if (typeof window === "undefined") {
    return "";
  }

  // GitHub Pages project sites live under /<repo>. Derive that at runtime
  // when the asset base is relative (`./`) so routing still resolves correctly.
  if (window.location.hostname.endsWith("github.io")) {
    const [repoSegment] = window.location.pathname.split("/").filter(Boolean);
    return repoSegment ? `/${repoSegment}` : "";
  }

  return "";
}

const routerBasename = getRouterBasename();

const AppContent = () => {
  return (
    <AppErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallPrompt />
        <BrowserRouter basename={routerBasename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppErrorBoundary>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
