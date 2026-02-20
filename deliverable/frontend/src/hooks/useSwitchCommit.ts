
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commitsApi } from '@/api'; // Updated import
import { useToast } from '@/hooks/use-toast';

export function useSwitchCommit(projectId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (commitHash: string) => commitsApi.switchProjectCommit(projectId, commitHash),
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.message,
      });
      // Invalidate commits query to reload the commit history
      queryClient.invalidateQueries({ queryKey: ['commits', projectId] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to switch commit',
        variant: 'destructive',
      });
    },
  });

  return mutation;
}
