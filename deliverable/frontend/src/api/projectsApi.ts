import { CreateProjectRequest, Project } from '@/types/project';
import { API_BASE_URL, API_CONFIG } from './config';
import { handleApiResponse, createApiError } from './utils';

export const projectsApi = {
  createProject: async (data: CreateProjectRequest): Promise<Project> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
        method: 'POST',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await createApiError(response);
        throw error;
      }

      return handleApiResponse(response);
    } catch (error) {
      console.error('Project creation failed:', error);
      throw error;
    }
  },

  getProjects: async (): Promise<Project[]> => {
    let timeoutId: number | null = null;
    
    try {
      // Only use the AbortController for timeout, not for component unmounting
      const controller = new AbortController();
      
      // Set a timeout that's reasonable for the API
      timeoutId = setTimeout(() => {
        console.log('Projects fetch timeout reached, aborting request');
        controller.abort();
      }, API_CONFIG.timeout) as unknown as number;
      
      const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
        method: 'GET',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
        signal: controller.signal
      });
      
      // Clear the timeout since we got a response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        const error = await createApiError(response);
        throw error;
      }

      const result = await handleApiResponse(response);
      return Array.isArray(result) ? result : [];
    } catch (error: any) {
      // Clear the timeout if there was an error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Don't log abort errors if they were caused by component unmount
      if (error.name === 'AbortError') {
        console.log('Projects fetch aborted');
        // Return empty array instead of throwing when aborted
        return [];
      }
      
      console.error('Projects fetch failed:', error);
      throw error;
    }
  },

  getProjectById: async (projectId: string): Promise<Project | null> => {
    try {
      // Since there's no specific endpoint for getting a project by ID,
      // we'll get all projects and filter for the one we want
      const projects = await projectsApi.getProjects();
      const project = projects.find(p => p.id === projectId);
      return project || null;
    } catch (error) {
      console.error('Project fetch failed:', error);
      throw error;
    }
  },

  deleteProject: async (projectId: string): Promise<{ message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        const error = await createApiError(response);
        throw error;
      }

      return handleApiResponse(response);
    } catch (error) {
      console.error('Project deletion failed:', error);
      throw error;
    }
  },

  downloadProject: async (projectId: string): Promise<Blob> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/download`, {
        method: 'GET',
        headers: {
          ...API_CONFIG.headers,
          'Accept': 'application/octet-stream',
        },
        mode: API_CONFIG.mode,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        const error = await createApiError(response);
        throw error;
      }

      return response.blob();
    } catch (error) {
      console.error('Project download failed:', error);
      throw error;
    }
  },

  getProjectFiles: async (projectId: string): Promise<any[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/files`, {
        method: 'GET',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        const error = await createApiError(response);
        throw error;
      }

      return handleApiResponse(response);
    } catch (error) {
      console.error('Project files fetch failed:', error);
      throw error;
    }
  },

  getFileContent: async (projectId: string, filePath: string): Promise<any> => {
    try {
      console.log(`API call: Getting content for project ${projectId}, file ${filePath}`);
      const url = `${API_BASE_URL}/api/v1/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`;
      console.log(`URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...API_CONFIG.headers,
          'Accept': 'application/json',
        },
        mode: API_CONFIG.mode,
      });

      if (!response.ok) {
        console.error(`Error response: ${response.status} ${response.statusText}`);
        if (response.status === 404) {
          throw new Error('File not found');
        }
        const error = await createApiError(response);
        throw error;
      }

      const result = await handleApiResponse(response);
      console.log('File content API response format:', typeof result, result ? Object.keys(result) : 'null');
      return result;
    } catch (error) {
      // Special case for HTML content errors - these might be due to valid HTML within JSON
      if (error.message && error.message.includes('HTML instead of JSON')) {
        console.warn('Received HTML error but will try to parse manually', error);
        try {
          // Make a new request and manually parse as text first
          const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`, {
            method: 'GET',
            headers: API_CONFIG.headers,
            mode: API_CONFIG.mode,
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }
          
          const text = await response.text();
          try {
            // Try to parse as JSON
            return JSON.parse(text);
          } catch (e) {
            // If parsing fails, return the raw text
            console.warn('Failed to parse as JSON, returning raw text');
            return {
              content: text,
              path: filePath,
              type: 'file'
            };
          }
        } catch (retryError) {
          console.error('Retry attempt also failed:', retryError);
          throw retryError;
        }
      }
      
      console.error('File content fetch failed:', error);
      throw error;
    }
  },

  getCommitHistory: async (projectId: string): Promise<any[]> => {
    try {
      console.log(`API call: Getting commit history for project ${projectId}`);
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/get-commits`, {
        method: 'GET', 
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        const error = await createApiError(response);
        throw error;
      }

      const result = await handleApiResponse(response);
      console.log('Commit history API response:', result);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Commit history fetch failed:', error);
      throw error;
    }
  },

  switchCommit: async (projectId: string, commitHash: string): Promise<any> => {
    try {
      console.log(`API call: Switching project ${projectId} to commit ${commitHash}`);
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/switch-commit`, {
        method: 'POST',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
        body: JSON.stringify({
          commit_hash: commitHash
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        const error = await createApiError(response);
        throw error;
      }

      const result = await handleApiResponse(response);
      console.log('Switch commit API response:', result);
      return result;
    } catch (error) {
      console.error('Switch commit failed:', error);
      throw error;
    }
  },

  startServer: async (projectId: string): Promise<any> => {
    try {
      console.log(`API call: Starting server for project ${projectId}`);
      
      // Create payload and log it
      const payload = { project_id: projectId };
      console.log('startServer payload:', JSON.stringify(payload, null, 2));
      console.log('startServer endpoint: http://localhost:5001/start');
      
      const response = await fetch(`http://localhost:5001/start`, {
        method: 'POST',
        headers: API_CONFIG.headers,
        mode: API_CONFIG.mode,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`startServer error status: ${response.status}`);
        const error = await createApiError(response);
        throw error;
      }

      const result = await handleApiResponse(response);
      console.log('startServer response:', result);
      return result;
    } catch (error) {
      console.error('Server start failed:', error);
      throw error;
    }
  },
};
