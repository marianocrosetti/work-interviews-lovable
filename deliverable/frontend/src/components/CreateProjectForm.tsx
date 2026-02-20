import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/api'; // Updated import
import { CreateProjectRequest, Project } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Create a schema for project validation
const projectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters long'),
});

type FormValues = z.infer<typeof projectSchema>;

interface CreateProjectFormProps {
  onSuccessfulCreation?: (project: Project) => void;
}

export default function CreateProjectForm({ onSuccessfulCreation }: CreateProjectFormProps) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
    },
  });
  const queryClient = useQueryClient();
  const [apiError, setApiError] = React.useState<string | null>(null);

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: (data) => {
      console.log("Project created successfully:", data);
      
      // Invalidate projects query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      toast({
        title: 'Success',
        description: `Project "${data.name}" created successfully!`,
      });
      setApiError(null);
      form.reset();
      
      // Call the callback if provided
      if (onSuccessfulCreation) {
        console.log("Calling onSuccessfulCreation with project:", data);
        onSuccessfulCreation(data);
      }
    },
    onError: (error: any) => {
      console.error("Project creation error:", error);
      
      // Handle backend validation errors
      if (error.errors) {
        // If we got a structured errors array from the backend
        setApiError(error.errors.join(', '));
      } else {
        setApiError(error instanceof Error ? error.message : 'Failed to create project');
      }
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create project',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    console.log("Submitting project creation form:", data);
    setApiError(null);
    createProjectMutation.mutate(data as CreateProjectRequest);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {apiError && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input placeholder="My Awesome Project" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2">
          <Button 
            type="submit" 
            disabled={createProjectMutation.isPending}
            className="w-full"
          >
            {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
          </Button>
          
          {createProjectMutation.isPending && (
            <p className="text-xs text-gray-500 text-center">This may take ~10 seconds</p>
          )}
        </div>
      </form>
    </Form>
  );
}
