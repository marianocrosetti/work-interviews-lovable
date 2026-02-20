import React from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

export function MarkdownRenderer({ text, streaming = false, className = '' }: MarkdownRendererProps) {
  if (!text) return null;

  return (
    <div className={cn('prose prose-invert max-w-none', streaming && 'markdown-streaming', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          pre: ({ node, className, ...props }) => (
            <pre className={cn('rounded-md p-4 overflow-auto bg-slate-800', className)} {...props} />
          ),
          code: ({ node, className, ...props }) => (
            <code className={cn('rounded bg-slate-800 px-1 py-0.5', className)} {...props} />
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              {children}
            </a>
          ),
          p: ({ children }) => <p className="mb-2">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-md font-bold mb-2 mt-4">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-400 pl-4 italic my-2">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="border-collapse border border-slate-700 my-2">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-700 bg-slate-800 px-4 py-2">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-700 px-4 py-2">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
} 