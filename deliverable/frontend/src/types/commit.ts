
export interface Commit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface CommitError {
  error: string;
  details?: string;
}

export interface SwitchCommitRequest {
  commit_hash: string;
}

export interface SwitchCommitResponse {
  success: boolean;
  message: string;
}
