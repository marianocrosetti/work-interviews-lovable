import { useQuery } from '@tanstack/react-query';
import { filesApi } from '@/api'; // Updated import
import { useState, useEffect } from 'react';
import { API_BASE_URL, API_CONFIG } from '@/api/config';

export function useFileContent(projectId: string, filePath: string) {
  const { data: fileContent, isLoading, error } = useQuery({
    queryKey: ['file-content', projectId, filePath],
    queryFn: () => filesApi.getFileContent(projectId, filePath),
    enabled: !!projectId && !!filePath,
  });

  const [connectionStatus, setConnectionStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({
    status: 'idle',
    message: '',
  });

  useEffect(() => {
    const testBackendConnection = async () => {
      setConnectionStatus({ status: 'loading', message: 'Testing backend connection...' });
      try {
        // Using API_BASE_URL from config
        const response = await fetch(`${API_BASE_URL}/api/v1/hello`, {
          method: 'GET',
          headers: API_CONFIG.headers,
          mode: API_CONFIG.mode,
        });
        
        if (response.ok) {
          const data = await response.json();
          setConnectionStatus({ 
            status: 'success', 
            message: `Hello endpoint successful: ${JSON.stringify(data)}` 
          });
          console.log('Backend /hello endpoint test successful:', data);
        } else {
          const errorText = await response.text();
          setConnectionStatus({ 
            status: 'error', 
            message: `Hello endpoint connection failed with status: ${response.status}` 
          });
          console.error('Backend /hello endpoint test failed:', response.status);
          console.error('Response details:', errorText);
        }
      } catch (err) {
        setConnectionStatus({ 
          status: 'error', 
          message: `Hello endpoint connection error: ${err instanceof Error ? err.message : String(err)}` 
        });
        console.error('Backend /hello endpoint connection error:', err);
      }
    };

    testBackendConnection();
  }, []);

  return { fileContent, isLoading, error, connectionStatus };
}
