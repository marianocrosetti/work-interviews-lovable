
export interface FileContent {
  name: string;
  path: string;
  size: number;
  modified: string;
  content: string;
}

export interface FileError {
  error: string;
  details?: string;
}
