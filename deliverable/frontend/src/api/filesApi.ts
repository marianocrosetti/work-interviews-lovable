
import { FileContent } from '@/types/file';
import { API_BASE_URL, API_CONFIG } from './config';
import { handleApiResponse, createApiError } from './utils';

export const filesApi = {
  getFileContent: async (projectId: string, filePath: string): Promise<FileContent> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`,
        {
          method: 'GET',
          headers: API_CONFIG.headers,
          mode: API_CONFIG.mode,
        }
      );

      if (!response.ok) {
        const error = await createApiError(response);
        throw error;
      }

      return handleApiResponse(response);
    } catch (error) {
      console.error('File content fetch failed:', error);
      throw error;
    }
  },
};
