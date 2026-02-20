import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  FileCode, 
  Eye, 
  Layout, 
  ChevronDown, 
  Edit, 
  FilePlus, 
  FileText, 
  Trash2, 
  Download 
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import CreateProjectForm from './CreateProjectForm';
import { Project } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { useToast } from "@/hooks/use-toast";
import { projectsApi } from '@/api';
import { useQueryClient } from '@tanstack/react-query';
import { Code } from 'lucide-react';
import { useProjectFiles } from '@/contexts/ProjectFilesContext';
import { clearChatHistory } from '@/hooks/useChat';

type ViewMode = 'preview' | 'code' | 'split';

interface HeaderProps {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  selectedProjectId?: string | null;
  onProjectChange?: (projectId: string) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  currentView, 
  setCurrentView, 
  selectedProjectId,
  onProjectChange 
}) => {
  const [projectName, setProjectName] = useState('code-sparkler');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { projects, isLoading, refetch } = useProjects();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { fetchProjectFiles } = useProjectFiles();

  console.log("Header component - Projects loaded:", projects.length, projects);
  console.log("Is loading projects:", isLoading);
  console.log("Selected project ID:", selectedProjectId);

  useEffect(() => {
    if (!isLoading && projects.length > 0) {
      const currentProjectId = getCurrentProjectId();
      const currentProject = projects.find(p => p.id === currentProjectId);
      
      if (currentProject) {
        console.log("Found current project:", currentProject.name);
        setProjectName(currentProject.name);
      } else if (onProjectChange && projects[0]) {
        console.log("No project selected, selecting first project:", projects[0].id);
        onProjectChange(projects[0].id);
        setProjectName(projects[0].name);
      }
    }
  }, [projects, location.pathname, isLoading, selectedProjectId]);

  const getCurrentProjectId = () => {
    if (selectedProjectId) {
      return selectedProjectId;
    }
    
    const pathname = location.pathname;
    if (pathname.includes('/projects/')) {
      return pathname.split('/projects/')[1];
    }
    if (pathname === '/' && projects && projects.length > 0) {
      return projects[0].id;
    }
    return null;
  };

  const handleEditName = () => {
    setIsEditing(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectName(e.target.value);
  };

  const handleNameSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleCreateProjectClick = () => {
    setIsCreateProjectDialogOpen(true);
    setIsDropdownOpen(false);
  };

  const handleProjectCreated = (newProject: Project) => {
    console.log("Project created, updating UI:", newProject);
    setProjectName(newProject.name);
    setIsCreateProjectDialogOpen(false);
    
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    
    if (onProjectChange) {
      console.log("Notifying parent of project change:", newProject.id);
      onProjectChange(newProject.id);
    }
  };

  const handleSelectProject = (project: Project) => {
    console.log("Project selected in dropdown:", project.id, project.name);
    setProjectName(project.name);
    setIsDropdownOpen(false);
    
    if (onProjectChange) {
      // Get the current project ID before changing
      const currentProjectId = getCurrentProjectId();
      
      // Clear chat history for the current project
      if (currentProjectId) {
        clearChatHistory(currentProjectId);
      }
      
      // Refresh project-related data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectFiles', project.id] });
      
      // Fetch files for the newly selected project
      fetchProjectFiles(project.id);
      
      // Start project server for preview
      projectsApi.startServer(project.id)
        .then(() => {
          console.log(`Started server for project ${project.id}`);
        })
        .catch((error) => {
          console.error(`Error starting server for project ${project.id}:`, error);
        });
      
      // Notify parent component about the project change
      onProjectChange(project.id);
      
      // Show success toast
      toast({
        title: "Project Changed",
        description: `Switched to project: ${project.name}`,
      });
    }
  };

  const handleViewDetails = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    navigate(`/projects/${projectId}`);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      await projectsApi.deleteProject(projectId);
      
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
    setIsDropdownOpen(false);
  };

  const handleDownload = async () => {
    try {
      const projectId = getCurrentProjectId();
      
      if (!projectId) {
        toast({
          title: "Error",
          description: "No project selected for download",
          variant: "destructive",
        });
        return;
      }

      const blob = await projectsApi.downloadProject(projectId);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Project download started",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download project",
        variant: "destructive",
      });
    }
  };

  const toggleCodeView = () => {
    const newView = currentView === 'code' ? 'preview' : 'code';
    setCurrentView(newView);
    
    if (newView === 'code') {
      const projectId = getCurrentProjectId();
      fetchProjectFiles(projectId);
    }
  };

  console.log("Rendering projects dropdown with projects:", projects.length);

  const handleDropdownOpenChange = (open: boolean) => {
    if (open) {
      console.log("Dropdown opened, refreshing projects");
      refetch().then(result => {
        console.log("Projects refreshed:", result.data);
      });
    }
    setIsDropdownOpen(open);
  };

  // Handle Publish button click - coming soon notification
  const handlePublish = () => {
    toast({
      title: "Coming Soon",
      description: "Prod deployment through Netlify coming soon...",
    });
  };

  return (
    <header className="bg-slate-900 text-white p-3 flex items-center justify-between border-b border-slate-700">
      <div className="flex items-center gap-2">
        <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
          <DropdownMenu open={isDropdownOpen} onOpenChange={handleDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center bg-slate-800 px-2 py-1 rounded cursor-pointer hover:bg-slate-700">
                <span className="text-amber-500 mr-2">●</span>
                {isEditing ? (
                  <Input
                    value={projectName}
                    onChange={handleNameChange}
                    onKeyDown={handleNameSubmit}
                    onBlur={handleBlur}
                    className="h-6 w-40 bg-slate-700 border-slate-600"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="text-sm font-mono">{projectName}</span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-slate-800 border-slate-700 text-slate-200">
              <DropdownMenuLabel>Your Projects</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onClick={handleEditName}>
                <Edit className="h-4 w-4" />
                <span>Rename Project</span>
              </DropdownMenuItem>
              
              {isLoading ? (
                <DropdownMenuItem disabled>Loading projects...</DropdownMenuItem>
              ) : projects.length === 0 ? (
                <DropdownMenuItem disabled>No projects available</DropdownMenuItem>
              ) : (
                projects.map((project) => (
                  <DropdownMenuItem 
                    key={project.id} 
                    onClick={() => handleSelectProject(project)}
                    className="flex items-center justify-between group"
                  >
                    <span>{project.name}</span>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => handleViewDetails(e, project.id)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Project Details</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => handleDeleteProject(e, project.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Project</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              
              <DropdownMenuSeparator />
              <DialogTrigger asChild>
                <DropdownMenuItem className="gap-2" onSelect={(e) => {
                  e.preventDefault();
                  handleCreateProjectClick();
                }}>
                  <FilePlus className="h-4 w-4" />
                  <span>Create New Project</span>
                </DropdownMenuItem>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <CreateProjectForm onSuccessfulCreation={handleProjectCreated} />
          </DialogContent>
        </Dialog>
        
        <div className="flex items-center space-x-2 bg-slate-800 rounded-full p-1 gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Code className="w-4 h-4 mr-2 text-slate-400" />
                  <span className="mr-2 text-sm text-slate-300">Developer mode</span>
                  <Switch
                    id="code-view-toggle"
                    checked={currentView === 'code'}
                    onCheckedChange={toggleCodeView}
                    className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-700"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Dev Mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <div className="absolute left-1/2 transform -translate-x-1/2 bg-slate-800 px-3 py-1 rounded text-sm text-slate-300 font-mono">
        Project ID: {getCurrentProjectId() || 'none'}
      </div>
      
      <div className="flex items-center space-x-4">
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleDownload}
          className="bg-blue-600 hover:bg-blue-700 h-9"
        >
          <Download className="w-4 h-4 mr-1" />
          Download
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default" 
                size="sm"
                onClick={handlePublish}
                className="bg-blue-600 hover:bg-blue-700 h-9"
              >
                Publish
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Netlify deployment (coming soon)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
};

export default Header;
