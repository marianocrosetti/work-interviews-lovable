export const handleApiResponse = async (response: Response) => {
  const responseText = await response.text();
  
  // First try to parse as JSON
  try {
    // Skip HTML check if the Content-Type is application/json
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return responseText ? JSON.parse(responseText) : null;
    }
    
    // Only check for HTML document structure, not any HTML content within JSON
    const trimmedText = responseText.trim();
    if (trimmedText.startsWith('<!DOCTYPE html>') || trimmedText.startsWith('<html')) {
      throw new Error('Received HTML document instead of JSON from API');
    }
    
    return responseText ? JSON.parse(responseText) : null;
  } catch (e) {
    if (e.message.includes('Received HTML')) {
      throw e;
    }
    console.error('Error parsing API response:', e);
    throw new Error('Failed to parse API response');
  }
};

export const createApiError = async (response: Response) => {
  try {
    const errorText = await response.text();
    const errorJson = JSON.parse(errorText);
    if (errorJson.errors) {
      return { 
        errors: errorJson.errors, 
        message: Array.isArray(errorJson.errors) ? errorJson.errors.join(', ') : 'Validation error' 
      };
    }
    return new Error(errorJson.error || `API error: ${response.status} ${response.statusText}`);
  } catch (e) {
    return new Error(`API error: ${response.status} ${response.statusText}`);
  }
};
