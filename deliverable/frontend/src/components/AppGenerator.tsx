import React, { useState, useEffect } from 'react';
import Header from './Header';
import ChatPanel from './ChatPanel';
import CodeEditor from './CodeEditor';
import PreviewPanel from './PreviewPanel';
import HistoryPanel from './HistoryPanel';
import ProjectFileExplorer from './ProjectFileExplorer';
import formTemplate from '../templates/form/App.tsx?raw';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { clearChatHistory } from '@/hooks/useChat';
import { useProjectFiles } from '@/contexts/ProjectFilesContext';
import { useToast } from '@/hooks/use-toast';

type ViewMode = 'preview' | 'code' | 'split';

interface CodeState {
  code: string;
  timestamp: Date;
  messageId: string;
}

const AppGenerator: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('preview');
  const [code, setCode] = useState<string>(formTemplate);
  const [currentFile, setCurrentFile] = useState<string>('src/App.tsx');
  const [filesContent, setFilesContent] = useState<Record<string, string>>({
    'src/App.tsx': formTemplate,
    'src/components/PreviewPanel.tsx': '// PreviewPanel component code',
    'src/components/CodeEditor.tsx': '// CodeEditor component code',
    'src/pages/Index.tsx': '// Index page code'
  });
  const [shouldReload, setShouldReload] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [codeHistory, setCodeHistory] = useState<CodeState[]>([
    {
      code: formTemplate,
      timestamp: new Date(),
      messageId: '1'
    }
  ]);
  
  const location = useLocation();
  const { projects } = useProjects();
  const { clearFiles } = useProjectFiles();
  const { toast } = useToast();
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  useEffect(() => {
    if (location.state && location.state.currentProjectId) {
      console.log("AppGenerator - Setting project from location state:", location.state.currentProjectId);
      setSelectedProjectId(location.state.currentProjectId);
    } else if (!selectedProjectId && projects && projects.length > 0) {
      console.log("AppGenerator - Auto-selecting first project:", projects[0].id);
      setSelectedProjectId(projects[0].id);
    }
  }, [location.state, projects, selectedProjectId]);

  const handleProjectChange = (newProjectId: string) => {
    console.log("AppGenerator - Project changed to:", newProjectId);
    
    // Reset application state for the new project
    setSelectedProjectId(newProjectId);
    setShowHistory(false);
    setShouldReload(true);
    
    // Clear chat history for the previous project
    if (selectedProjectId) {
      clearChatHistory(selectedProjectId);
    }
    
    // Clear file explorer
    clearFiles();
    
    // Reset code view if needed
    if (currentView === 'code' || currentView === 'split') {
      // Reset to default file when changing projects
      setCurrentFile('src/App.tsx');
      setCode('// Loading project files...');
    }
    
    // Show toast notification
    toast({
      title: "Project Changed",
      description: "Switched to new project",
    });
  };

  const generateAiResponse = (userMessage: string): string => {
    const responses = [
      "I've updated the code based on your request.",
      "Here's the implementation you asked for.",
      "I've added the feature you requested.",
      "I've modified the code as suggested.",
      "The changes have been implemented.",
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleSaveCode = () => {
    setFilesContent(prev => ({
      ...prev,
      [currentFile]: code
    }));
    setShouldReload(true);
    
    const newCodeState = {
      code,
      timestamp: new Date(),
      messageId: 'manual-save-' + Date.now()
    };
    
    setCodeHistory(prev => [...prev, newCodeState]);
  };

  const handleReloadComplete = () => {
    setShouldReload(false);
  };

  const handleRestoreVersion = (historyItem: CodeState) => {
    setCode(historyItem.code);
    setShouldReload(true);
    setShowHistory(false);
  };

  const toggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  const handleFileChange = (path: string) => {
    setCurrentFile(path);
    setCode(filesContent[path]);
  };

  const handleFileSelect = (path: string, content: string) => {
    setCurrentFile(path);
    setCode(content);
    
    // Update filesContent
    setFilesContent(prev => ({
      ...prev,
      [path]: content
    }));
  };

  console.log(`Current view: ${currentView}, Selected project ID: ${selectedProjectId}`);

  // If we're in code view but don't have a project ID, show an error
  const shouldShowFileExplorer = currentView === 'code' && selectedProjectId;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      <div className="fixed top-0 left-0 right-0 z-[100] shadow-lg">
        <Header 
          currentView={currentView} 
          setCurrentView={setCurrentView} 
          selectedProjectId={selectedProjectId}
          onProjectChange={handleProjectChange}
        />
      </div>
      
      <div className="flex-1 flex overflow-hidden pt-[64px]">
        <div className={`w-[350px] flex flex-col ${currentView === 'preview' ? 'hidden md:flex' : ''}`}>
          {showHistory ? (
            <HistoryPanel 
              onClose={() => setShowHistory(false)}
              projectId={selectedProjectId}
            />
          ) : (
            <div className="flex flex-col h-full">
              <div className="sticky top-0 z-50 bg-slate-800 text-white px-4 py-3 h-[60px] border-b border-slate-700 flex justify-between items-center shadow-md">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleHistory} 
                  className={`${showHistory ? 'bg-slate-700' : ''} px-4 flex items-center gap-2 bg-slate-700 hover:bg-slate-600`}
                >
                  <History size={16} />
                  <span>History</span>
                </Button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <ChatPanel projectId={selectedProjectId || ''} />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          {shouldShowFileExplorer && (
            <ProjectFileExplorer 
              onFileSelect={handleFileSelect}
              projectId={selectedProjectId || ''}
            />
          )}
          
          {(currentView === 'code' || currentView === 'split') && (
            <div className={`${currentView === 'split' ? 'w-1/2' : 'flex-1 max-w-3xl'} flex flex-col`}>
              <CodeEditor 
                code={code} 
                setCode={setCode} 
                filePath={currentFile}
                onSave={handleSaveCode}
                onFileChange={handleFileChange}
                selectedProjectId={selectedProjectId}
              />
            </div>
          )}
          
          {(currentView === 'preview' || currentView === 'split') && (
            <div className={`${currentView === 'split' ? 'w-1/2' : 'w-full'} flex flex-col`}>
              <PreviewPanel 
                code={code}
                shouldReload={shouldReload}
                onReloadComplete={handleReloadComplete}
                selectedProjectId={selectedProjectId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppGenerator;
