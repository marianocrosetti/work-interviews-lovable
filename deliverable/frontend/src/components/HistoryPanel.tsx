import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useCommitHistory } from '@/hooks/useCommitHistory';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { projectsApi } from '@/api/projectsApi';
import { useToast } from '@/hooks/use-toast';

interface CodeState {
  code: string;
  timestamp: Date;
  messageId: string;
}

interface Commit {
  hash: string;
  title: string;
  author: string;
  date: string;
}

interface HistoryPanelProps {
  onClose: () => void;
  projectId?: string | null;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ 
  onClose,
  projectId 
}) => {
  const { commits, isLoading, error, refetch } = useCommitHistory(projectId);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Parse the date from string format
  const formatDate = (dateString: string) => {
    try {
      // Handle ISO format dates
      if (dateString.includes('T')) {
        return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
      }
      
      // Handle Git date format
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      console.error("Error parsing date:", e);
      return dateString;
    }
  };

  const handleRestoreCommit = async (commitHash: string) => {
    if (!projectId) return;
    
    try {
      setIsRestoring(commitHash);
      
      await projectsApi.switchCommit(projectId, commitHash);
      
      toast({
        title: "Success",
        description: `Successfully switched to commit ${commitHash.substring(0, 7)}`,
      });
      
      // Close history panel after successful restore
      onClose();
      
      // Reload the page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Error restoring commit:', error);
      toast({
        title: "Error",
        description: `Failed to restore commit: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsRestoring(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full border-r border-slate-700 bg-slate-900">
      <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center">
          <h2 className="text-sm font-semibold">Git History</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-20">
            <LoaderCircle className="animate-spin text-slate-400" size={24} />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400">
            Failed to load commit history
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 mx-auto block"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : commits.length === 0 ? (
          <div className="p-4 text-center text-slate-400">
            No git history available for this project
          </div>
        ) : (
          commits.map((commit, index) => (
            <div 
              key={commit.hash}
              className="mb-2 p-2 bg-slate-800 rounded border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-semibold truncate">
                  {commit.title}
                </h3>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">
                  {commit.author}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDate(commit.date)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-mono">
                  {commit.hash.substring(0, 7)}
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-6 text-xs px-2 py-0 ml-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700"
                  onClick={() => handleRestoreCommit(commit.hash)}
                  disabled={isRestoring === commit.hash}
                >
                  {isRestoring === commit.hash ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    'Restore'
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;
