
import React from 'react';
import { Folder, ChevronRight, File } from 'lucide-react';
import { cn } from "@/lib/utils";

interface FileTreeProps {
  files: string[];
  selectedFile: string;
  onFileSelect: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: TreeNode[];
}

const FileTree: React.FC<FileTreeProps> = ({ files, selectedFile, onFileSelect }) => {
  const buildTree = (paths: string[]): TreeNode[] => {
    const root: TreeNode[] = [];
    
    paths.forEach(path => {
      const parts = path.split('/');
      let currentLevel = root;
      
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        const existing = currentLevel.find(node => node.name === part);
        
        if (!existing) {
          const newNode: TreeNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            children: [],
          };
          currentLevel.push(newNode);
          currentLevel = newNode.children;
        } else {
          currentLevel = existing.children;
        }
      });
    });
    
    return root;
  };

  const renderNode = (node: TreeNode, level: number = 0) => {
    const isSelected = node.path === selectedFile;
    
    return (
      <div key={node.path} className="w-full">
        <button
          onClick={() => node.type === 'file' && onFileSelect(node.path)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-slate-700/50 rounded",
            isSelected && "bg-slate-700",
            "text-left"
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {node.type === 'directory' ? (
            <>
              <ChevronRight className="w-4 h-4" />
              <Folder className="w-4 h-4 text-slate-400" />
            </>
          ) : (
            <File className="w-4 h-4 text-slate-400" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        
        {node.children.map(child => renderNode(child, level + 1))}
      </div>
    );
  };

  const tree = buildTree(files);

  return (
    <div className="w-full overflow-auto">
      {tree.map(node => renderNode(node))}
    </div>
  );
};

export default FileTree;
