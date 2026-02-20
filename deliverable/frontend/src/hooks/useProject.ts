
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api'; // Updated import

export function useProject(projectId: string) {
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProjectById(projectId),
    enabled: !!projectId,
  });

  return { project, isLoading };
}
