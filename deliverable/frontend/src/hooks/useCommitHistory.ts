import { useState, useEffect, useCallback } from 'react';
import { projectsApi } from '@/api/projectsApi';
import { useToast } from '@/hooks/use-toast';

interface Commit {
  hash: string;
  title: string;
  author: string;
  date: string;
}

export const useCommitHistory = (projectId: string | null) => {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchCommitHistory = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const commitHistory = await projectsApi.getCommitHistory(projectId);
      setCommits(commitHistory);
    } catch (err) {
      console.error('Error fetching commit history:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch commit history'));
      
      toast({
        title: 'Error',
        description: 'Failed to load commit history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (projectId) {
      fetchCommitHistory();
    }
  }, [projectId, fetchCommitHistory]);

  return {
    commits,
    isLoading,
    error,
    refetch: fetchCommitHistory
  };
};
