import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react';
import { useProjectFiles } from '@/contexts/ProjectFilesContext';
import { useToast } from '@/hooks/use-toast';

// Define the project file interface
interface ProjectFile {
  path: string;
  name?: string;
  is_directory?: boolean;
  size?: number;
  type?: 'file' | 'directory';
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: FileTreeNode[];
}

interface FileExplorerItemProps {
  node: FileTreeNode;
  level: number;
  onSelect: (path: string, type: 'file' | 'directory') => void;
  selectedPath: string | null;
}

const FileExplorerItem: React.FC<FileExplorerItemProps> = ({
  node,
  level,
  onSelect,
  selectedPath
}) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const isDirectory = node.type === 'directory';
  const isSelected = node.path === selectedPath;
  
  const toggle = () => {
    if (isDirectory) {
      setIsOpen(!isOpen);
    }
    onSelect(node.path, node.type);
  };
  
  return (
    <div className="text-sm">
      <div 
        className={`flex items-center py-1 px-2 hover:bg-slate-700 cursor-pointer ${isSelected ? 'bg-slate-700' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={toggle}
      >
        {isDirectory ? (
          <>
            {isOpen ? 
              <ChevronDown className="w-4 h-4 mr-1 text-slate-400" /> : 
              <ChevronRight className="w-4 h-4 mr-1 text-slate-400" />
            }
            <Folder className="w-4 h-4 mr-2 text-blue-400" />
          </>
        ) : (
          <>
            <span className="w-4 mr-1"></span>
            <File className="w-4 h-4 mr-2 text-slate-400" />
          </>
        )}
        <span className={`${isSelected ? 'text-white' : 'text-slate-200'} truncate`}>{node.name}</span>
      </div>
      
      {/* Render children if directory is open */}
      {isDirectory && isOpen && node.children.length > 0 && (
        <div>
          {node.children.map((child, index) => (
            <FileExplorerItem
              key={child.path + index}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ProjectFileExplorerProps {
  onFileSelect?: (path: string, content: string) => void;
  projectId: string;
}

const ProjectFileExplorer: React.FC<ProjectFileExplorerProps> = ({
  onFileSelect,
  projectId
}) => {
  const { projectFiles, isLoadingFiles, fetchProjectFiles, getFileContent } = useProjectFiles();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const { toast } = useToast();
  const lastProjectIdRef = useRef<string | null>(null);
  
  // Build file tree from flat list
  const buildFileTree = useCallback((files: ProjectFile[]) => {
    // Sort files to make directories come before files
    const sortedFiles = [...files].sort((a, b) => {
      // First, sort directories before files
      if (a.is_directory !== b.is_directory) {
        return a.is_directory ? -1 : 1;
      }
      // Then sort by name
      return a.path.localeCompare(b.path);
    });
    
    const root: FileTreeNode[] = [];
    const map: Record<string, FileTreeNode> = {};
    
    // First, create nodes for all directories
    sortedFiles.forEach(file => {
      const parts = file.path.split('/');
      
      // Add missing directories
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!map[currentPath]) {
          const node: FileTreeNode = {
            name: part,
            path: currentPath,
            type: 'directory',
            children: []
          };
          map[currentPath] = node;
          
          // Add to parent if exists, otherwise to root
          if (i > 0) {
            const parentPath = parts.slice(0, i).join('/');
            if (map[parentPath]) {
              map[parentPath].children.push(node);
            } else {
              root.push(node);
            }
          } else {
            root.push(node);
          }
        }
      }
    });
    
    // Then, add files to their directories
    sortedFiles.forEach(file => {
      const isDirectory = file.is_directory || (!file.path.includes('.') && !file.size);
      const type = isDirectory ? 'directory' : 'file';
      const parts = file.path.split('/');
      const name = parts[parts.length - 1];
      
      // Skip if it's a directory we already created
      if (isDirectory && map[file.path]) {
        return;
      }
      
      const node: FileTreeNode = {
        name,
        path: file.path,
        type,
        children: []
      };
      
      map[file.path] = node;
      
      // Add to parent if exists, otherwise to root
      if (parts.length > 1) {
        const parentPath = parts.slice(0, parts.length - 1).join('/');
        if (map[parentPath]) {
          map[parentPath].children.push(node);
        } else {
          root.push(node);
        }
      } else {
        root.push(node);
      }
    });
    
    return root;
  }, []);
  
  // Load files when component mounts or when projectId changes
  useEffect(() => {
    // Only fetch if projectId exists and it's different from the last one
    if (projectId && projectId !== lastProjectIdRef.current) {
      lastProjectIdRef.current = projectId;
      fetchProjectFiles(projectId);
    }
  }, [projectId, fetchProjectFiles]);
  
  // Build tree when files change
  useEffect(() => {
    if (projectFiles.length > 0) {
      const tree = buildFileTree(projectFiles);
      setFileTree(tree);
    }
  }, [projectFiles, buildFileTree]);
  
  const handleSelectFile = useCallback(async (path: string, type: string) => {
    console.log(`File selected: ${path}, type: ${type}`);
    setSelectedPath(path);
    
    if (type === 'file' && onFileSelect) {
      try {
        console.log(`Fetching content for file: ${path}`);
        const content = await getFileContent(projectId || null, path);
        
        if (!content) {
          console.warn(`No content received for file: ${path}`);
          toast({
            title: "Error",
            description: `Unable to load content for ${path}`,
            variant: "destructive",
          });
          return;
        }
        
        console.log(`Content received for ${path}, length: ${content.length}`);
        onFileSelect(path, content);
      } catch (error) {
        console.error(`Error getting content for file ${path}:`, error);
        toast({
          title: "Error",
          description: `Failed to load content: ${error.message || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    }
  }, [projectId, onFileSelect, getFileContent, toast]);
  
  return (
    <div className="bg-slate-800 border-r border-slate-700 w-96 overflow-auto h-full">
      <div className="sticky top-0 z-40 p-3 text-white font-medium border-b border-slate-700 flex justify-between items-center bg-slate-800 h-[60px] shadow-md">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-blue-400" />
          <span className="text-base">Project Files</span>
        </div>
        {isLoadingFiles && <span className="text-sm text-slate-400 bg-slate-700 px-2 py-1 rounded">Loading...</span>}
      </div>
      
      <div className="py-2">
        {fileTree.length > 0 ? (
          fileTree.map((node, index) => (
            <FileExplorerItem
              key={node.path + index}
              node={node}
              level={0}
              onSelect={handleSelectFile}
              selectedPath={selectedPath}
            />
          ))
        ) : (
          <div className="px-4 py-2 text-slate-400 text-sm">
            {isLoadingFiles ? 'Loading project files...' : 'No files found'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectFileExplorer; 