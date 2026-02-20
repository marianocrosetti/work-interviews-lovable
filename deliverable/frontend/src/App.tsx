import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ProjectDetails from "./pages/ProjectDetails";
import NotFound from "./pages/NotFound";
import React from "react";
import { ProjectFilesProvider } from "./contexts/ProjectFilesContext";
import { PreviewProvider } from "./context/PreviewContext";
import { UserSettingsProvider } from "./context/UserSettingsContext";

// Create the QueryClient in the component
const App = () => {
  // Create a client
  const queryClient = React.useState(() => new QueryClient())[0];
  
  return (
    <QueryClientProvider client={queryClient}>
      <UserSettingsProvider>
        <ProjectFilesProvider>
          <PreviewProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/projects/:projectId" element={<ProjectDetails />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </PreviewProvider>
        </ProjectFilesProvider>
      </UserSettingsProvider>
    </QueryClientProvider>
  );
};

export default App;
