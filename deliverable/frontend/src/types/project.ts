export interface CreateProjectRequest {
  name: string;
  // description is optional and no longer requested in the form
  description?: string;
  template?: string;
  // first_message is optional and no longer requested in the form
  first_message?: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  content?: string;
  size?: number;
  is_dir?: boolean;
}

export interface Project {
  id: string;
  name: string;
  first_message?: string;
  created_at: string;
  updated_at: string;
  path: string;
  ai_title?: string;
  ai_description?: string;
  files?: ProjectFile[];
}

export interface ProjectError {
  error?: string;
  details?: string;
  errors?: string[];
  message?: string;
}
