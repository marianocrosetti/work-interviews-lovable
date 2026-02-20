import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api'; // Updated import
import { toast } from '@/components/ui/use-toast';

export function useProjects() {
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isError
  } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      console.log('Fetching projects in useProjects hook');
      try {
        const result = await projectsApi.getProjects();
        console.log('Projects fetched successfully:', result);
        return result;
      } catch (err: any) {
        // Don't throw AbortError as it's handled in projectsApi
        if (err.name === 'AbortError') {
          console.log('Query aborted in useProjects');
          return []; // Return empty array for aborted requests
        }
        console.error('Error in useProjects queryFn:', err);
        throw err;
      }
    },
    staleTime: 30 * 1000, // Increase stale time to 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      // Don't retry on AbortError
      if (error.name === 'AbortError') return false;
      return failureCount < 2; // Only retry twice for other errors
    },
    retryDelay: 1000,
    meta: {
      onError: (error: Error) => {
        // Don't show toast for AbortError
        if (error.name === 'AbortError') return;
        
        console.error('Failed to fetch projects:', error);
        toast({
          title: 'Error fetching projects',
          description: error.message || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    }
  });

  // Default to empty array if no data is available
  const projects = data || [];
  
  // Log for debugging
  console.log("useProjects hook returning projects:", projects);
  
  return { 
    projects, 
    isLoading, 
    error, 
    refetch,
    isError
  };
}
