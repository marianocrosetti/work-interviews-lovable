import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { projectsApi } from '@/api/projectsApi';

interface ProjectFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
}

interface ProjectFilesContextType {
  projectFiles: ProjectFile[];
  isLoadingFiles: boolean;
  fetchProjectFiles: (projectId: string | null) => Promise<void>;
  getFileContent: (projectId: string | null, filePath: string) => Promise<string | null>;
  clearFiles: () => void;
}

const ProjectFilesContext = createContext<ProjectFilesContextType | undefined>(undefined);

export const useProjectFiles = () => {
  const context = useContext(ProjectFilesContext);
  if (!context) {
    throw new Error('useProjectFiles must be used within a ProjectFilesProvider');
  }
  return context;
};

interface ProjectFilesProviderProps {
  children: ReactNode;
}

export const ProjectFilesProvider: React.FC<ProjectFilesProviderProps> = ({ children }) => {
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const { toast } = useToast();

  const fetchProjectFiles = async (projectId: string | null) => {
    if (!projectId) return;
    
    setIsLoadingFiles(true);
    try {
      const files = await projectsApi.getProjectFiles(projectId);
      setProjectFiles(files);
      console.log("Fetched project files:", files);
    } catch (error) {
      console.error("Error fetching project files:", error);
      toast({
        title: "Error",
        description: "Failed to load project files",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const clearFiles = () => {
    setProjectFiles([]);
    setIsLoadingFiles(false);
    console.log("Cleared project files");
  };

  const getFileContent = async (projectId: string | null, filePath: string): Promise<string | null> => {
    if (!projectId) return null;
    
    try {
      console.log(`Fetching content for project ${projectId}, file: ${filePath}`);
      const response = await projectsApi.getFileContent(projectId, filePath);
      console.log('API response:', response);
      
      if (!response) {
        console.warn('No response received');
        return null;
      }
      
      // If the response has a content property, use it
      if (response.content !== undefined) {
        // Special case for HTML content - it's already in string form
        return response.content;
      }
      
      // If there's no content property but we have a response body
      console.warn('Unexpected response format:', response);
      if (typeof response === 'string') {
        return response;
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching file content:", error);
      toast({
        title: "Error",
        description: `Failed to load file content: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      return null;
    }
  };

  return (
    <ProjectFilesContext.Provider value={{ projectFiles, isLoadingFiles, fetchProjectFiles, getFileContent, clearFiles }}>
      {children}
    </ProjectFilesContext.Provider>
  );
}; 