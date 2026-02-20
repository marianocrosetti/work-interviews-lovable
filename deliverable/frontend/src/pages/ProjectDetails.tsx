import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useProject } from '@/hooks/useProject';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { projectsApi } from '@/api';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { useQueryClient } from '@tanstack/react-query';

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, isLoading } = useProject(projectId || '');
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  
  const handleGoBack = () => {
    navigate('/', { state: { currentProjectId: projectId } });
  };

  const handleDelete = async () => {
    if (!projectId) return;
    
    try {
      await projectsApi.deleteProject(projectId);
      
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Project not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 relative">
      <div className="flex justify-between items-center absolute top-4 left-4 right-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleGoBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleDelete}
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

      <Card className="mt-12">
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">AI Title</h3>
              <p>{project.ai_title}</p>
            </div>
            <div>
              <h3 className="font-medium">Description</h3>
              <p>{project.ai_description}</p>
            </div>
            <div>
              <h3 className="font-medium">Created</h3>
              <p>{new Date(project.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <h3 className="font-medium">Last Updated</h3>
              <p>{new Date(project.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetails;
