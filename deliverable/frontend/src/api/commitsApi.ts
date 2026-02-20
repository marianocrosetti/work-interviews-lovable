
import { Commit, CommitError, SwitchCommitRequest, SwitchCommitResponse } from '@/types/commit';
import { API_BASE_URL, API_CONFIG } from './config';
import { handleApiResponse, createApiError } from './utils';

export const commitsApi = {
  getProjectCommits: async (projectId: string): Promise<Commit[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/get-commits`, {
        method: 'POST',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        const error = await createApiError(response);
        throw error;
      }

      return handleApiResponse(response);
    } catch (error) {
      console.error('Commits fetch failed:', error);
      throw error;
    }
  },

  switchProjectCommit: async (projectId: string, commitHash: string): Promise<SwitchCommitResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/switch-commit`, {
        method: 'POST',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
        body: JSON.stringify({ commit_hash: commitHash } as SwitchCommitRequest)
      });

      if (!response.ok) {
        const error = await createApiError(response);
        throw error;
      }

      return handleApiResponse(response);
    } catch (error) {
      console.error('Commit switch failed:', error);
      throw error;
    }
  },
};
