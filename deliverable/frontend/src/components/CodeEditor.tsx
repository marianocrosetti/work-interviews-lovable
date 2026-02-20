import React, { useState, useEffect } from 'react';
import { Code } from 'lucide-react';
import { useProject } from '@/hooks/useProject';

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  filePath: string;
  onSave: () => void;
  onFileChange: (path: string) => void;
  selectedProjectId?: string | null;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  setCode, 
  filePath, 
  onSave,
  onFileChange,
  selectedProjectId
}) => {
  // Ensure code is not undefined before rendering
  const safeCode = code || '';

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
  };

  return (
    <div className="flex flex-col h-full bg-editor-bg border-r border-slate-700">
      <div className="sticky top-0 z-40 bg-slate-800 text-white p-4 border-b border-slate-700 flex justify-between items-center h-[60px] shadow-md">
        <div className="flex items-center gap-3 flex-1">
          <Code className="w-5 h-5 text-blue-400" />
          <span className="text-base font-medium text-white">Code Editor</span>
          <span className="text-sm text-slate-300 font-mono bg-slate-700 px-2 py-1 rounded">{filePath}</span>
        </div>
        {/* Save button hidden for now - to be implemented in future */}
        <button 
          className="hidden text-xs py-1 px-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          onClick={onSave}
        >
          Save
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Code area */}
          <div className="flex-1 flex">
            {/* Line numbers */}
            <div className="bg-[#1e1e1e] text-editor-line-number p-2 text-right select-none w-12 overflow-y-hidden">
              {safeCode.split('\n').map((_, i) => (
                <div key={i} className="font-mono text-xs">
                  {i + 1}
                </div>
              ))}
            </div>
            
            {/* Code area */}
            <textarea
              value={safeCode}
              onChange={handleCodeChange}
              className="flex-1 bg-editor-bg text-editor-text font-mono p-2 resize-none outline-none overflow-auto"
              spellCheck="false"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
