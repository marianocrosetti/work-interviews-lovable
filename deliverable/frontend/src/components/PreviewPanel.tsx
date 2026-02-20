import React, { useEffect, useState, useRef } from 'react';
import { Loader, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { projectsApi } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'react-router-dom';
import { usePreviewContext } from '@/context/PreviewContext';

interface PreviewPanelProps {
  code?: string;
  shouldReload?: boolean;
  onReloadComplete?: () => void;
  externalUrl?: string;
  selectedProjectId?: string | null;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  code, 
  shouldReload = false,
  onReloadComplete,
  externalUrl = 'http://localhost:3035',
  selectedProjectId
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { toast } = useToast();
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { previewPath } = usePreviewContext();
  
  const getCurrentProjectId = () => {
    // Log the source of the project ID
    console.log("selectedProjectId prop:", selectedProjectId);
    console.log("Current location path:", location.pathname);
    
    if (selectedProjectId) {
      console.log("Using selectedProjectId prop:", selectedProjectId);
      return selectedProjectId;
    }
    
    const pathname = location.pathname;
    if (pathname.includes('/projects/')) {
      const extractedId = pathname.split('/projects/')[1].split('/')[0];
      console.log("Extracted project ID from URL:", extractedId);
      return extractedId;
    }
    
    console.log("No project ID found, returning null");
    return null;
  };

  // Start server when component mounts or project changes
  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) return;
    
    console.log(`[MOUNT] Mounting preview for project: ${projectId}`);
    
    // Mount the server for the initial load
    const mountServer = async () => {
      try {
        console.log(`[MOUNT] Initial server mount - Payload: { project_id: "${projectId}" }`);
        await projectsApi.startServer(projectId);
        console.log(`[MOUNT] Server mount request sent for project ${projectId}`);
      } catch (error) {
        console.error(`[MOUNT] Failed to mount server for project ${projectId}:`, error);
      }
    };
    
    mountServer();
    
    // Continue with server status check
    checkServerStatus(projectId);
  }, [selectedProjectId]);
  
  // Check if server is ready
  const checkServerStatus = (projectId: string | null) => {
    if (!projectId) return;
    
    setServerReady(false);
    setServerError(null);
    setLoading(true);
    
    const checkStatus = async () => {
      try {
        await fetch(`${externalUrl}/health?t=${Date.now()}`, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache',
        });
        setServerReady(true);
        setServerError(null);
        return true;
      } catch (error) {
        console.log("Server not ready yet, will retry...");
        return false;
      }
    };
    
    // Try immediately
    checkStatus();
    
    // Then retry every 2 seconds up to 10 times
    let attempts = 0;
    const maxAttempts = 10;
    
    const interval = setInterval(async () => {
      attempts++;
      const isReady = await checkStatus();
      
      if (isReady || attempts >= maxAttempts) {
        clearInterval(interval);
        
        if (attempts >= maxAttempts && !isReady) {
          setServerError("Could not connect to preview server. You may need to refresh.");
        }
        
        setLoading(false);
        if (onReloadComplete) {
          onReloadComplete();
        }
      }
    }, 2000);
    
    return () => clearInterval(interval);
  };

  // Force iframe reload when needed
  useEffect(() => {
    if (shouldReload && iframeRef.current && serverReady) {
      try {
        // Force reload the iframe content
        const iframe = iframeRef.current;
        iframe.src = `${externalUrl}${previewPath || ''}?reload=${Date.now()}`;
      } catch (error) {
        console.error("Error reloading iframe:", error);
      }
    }
  }, [shouldReload, externalUrl, previewPath, serverReady]);

  const handleRefreshPreview = async () => {
    const projectId = getCurrentProjectId();
    
    if (!projectId) {
      console.error("[REFRESH] No project ID available for refresh");
      toast({
        title: "Error",
        description: "No project selected for preview refresh",
        variant: "destructive",
      });
      return;
    }
    
    console.log("%c[REFRESH] Refreshing preview with project_id:", "color: blue; font-weight: bold", projectId);
    console.log("%c[REFRESH] Request payload:", "color: blue; font-weight: bold", { project_id: projectId });
    console.log("%c[REFRESH] Endpoint:", "color: blue; font-weight: bold", "http://localhost:5001/start");
    
    setRefreshing(true);
    setServerReady(false);
    setServerError(null);
    
    try {
      console.log(`[REFRESH] Starting refresh process for project ${projectId}...`);
      
      // Call the API to start/mount the server
      console.log(`[REFRESH] Calling projectsApi.startServer with projectId: "${projectId}"`);
      const startResult = await projectsApi.startServer(projectId);
      console.log(`[REFRESH] Server start result:`, startResult);
      
      // Wait for server to be ready before refreshing iframe
      let attempts = 0;
      const maxAttempts = 15; // Increased max attempts
      
      const checkServerAndRefresh = async () => {
        try {
          console.log(`[REFRESH] Health check attempt ${attempts+1}/${maxAttempts}`);
          const healthResponse = await fetch(`${externalUrl}/health?t=${Date.now()}`, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache',
          });
          
          console.log(`[REFRESH] Health check status: ${healthResponse.status}`);
          setServerReady(true);
          
          // Refresh the iframe after server starts
          if (iframeRef.current) {
            const newSrc = `${externalUrl}${previewPath || ''}?reload=${Date.now()}`;
            console.log(`[REFRESH] Updating iframe src to: ${newSrc}`);
            iframeRef.current.src = newSrc;
          }
          
          toast({
            title: "Success",
            description: "Preview refreshed successfully",
          });
          
          return true;
        } catch (error) {
          console.log(`[REFRESH] Server not ready yet (attempt ${attempts+1}/${maxAttempts}), will retry...`);
          attempts++;
          
          if (attempts >= maxAttempts) {
            console.error("[REFRESH] Max attempts reached, giving up.");
            setServerError("Could not connect to preview server. Try again later.");
            toast({
              title: "Error",
              description: "Failed to connect to preview server",
              variant: "destructive",
            });
            return true; // End retry loop
          }
          
          return false; // Continue retry loop
        }
      };
      
      // Use recursive setTimeout for more reliable timing
      const waitForServer = async () => {
        const isReady = await checkServerAndRefresh();
        if (!isReady) {
          setTimeout(waitForServer, 2000);
        } else {
          setRefreshing(false);
        }
      };
      
      waitForServer();
      
    } catch (error) {
      console.error("[REFRESH] Failed to refresh preview:", error);
      toast({
        title: "Error",
        description: "Failed to refresh preview server",
        variant: "destructive",
      });
      setRefreshing(false);
      setServerError("Error starting preview server");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="sticky top-0 z-40 bg-slate-800 text-white p-4 border-b border-slate-700 flex justify-between items-center h-[60px] shadow-md">
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleRefreshPreview}
          disabled={refreshing}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Preview
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto relative">
        {loading || refreshing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-600">
              {refreshing ? "Refreshing preview..." : "Loading preview..."}
            </span>
          </div>
        ) : serverError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-orange-500 mb-2" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Preview Unavailable</h3>
            <p className="text-gray-600 mb-4">{serverError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPreview}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : serverReady ? (
          <iframe
            ref={iframeRef}
            src={`${externalUrl}${previewPath || ''}?t=${Date.now()}`}
            title="External Preview"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
            allow="fullscreen"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
            <Loader className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Connecting to preview server...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
