import React, { useState, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

interface RichTextEditorProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  height?: number;
  readOnly?: boolean;
  hideToolbar?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter description...",
  height = 200,
  readOnly = false,
  hideToolbar = false
}) => {
  const [content, setContent] = useState(value || '');

  const handleChange = useCallback((val?: string) => {
    const newValue = val || '';
    setContent(newValue);
    onChange(newValue || null);
  }, [onChange]);

  // For read-only preview mode
  if (readOnly) {
    return (
      <div className="rich-text-preview">
        <MDEditor.Markdown 
          source={content || placeholder} 
          style={{ 
            backgroundColor: 'transparent',
            color: 'inherit'
          }}
        />
      </div>
    );
  }

  return (
    <div className="rich-text-editor">
      <MDEditor
        value={content}
        onChange={handleChange}
        height={height}
        data-color-mode="auto"
        visibleDragbar={false}
        hideToolbar={hideToolbar}
        preview="edit"
        textareaProps={{
          placeholder,
          style: {
            fontSize: '14px',
            lineHeight: '1.5',
            fontFamily: 'inherit'
          }
        }}
        style={{
          backgroundColor: 'var(--bs-body-bg)',
        }}
      />
      
      <style>{`
        .rich-text-editor .w-md-editor {
          background-color: var(--bs-body-bg);
          border: 1px solid var(--bs-border-color);
          border-radius: 0.375rem;
        }
        
        .rich-text-editor .w-md-editor-toolbar {
          background-color: var(--bs-secondary-bg);
          border-bottom: 1px solid var(--bs-border-color);
        }
        
        .rich-text-editor .w-md-editor-text-textarea,
        .rich-text-editor .w-md-editor-text {
          background-color: var(--bs-body-bg) !important;
          color: var(--bs-body-color) !important;
          font-family: inherit !important;
        }
        
        .rich-text-editor .w-md-editor-text-textarea::placeholder {
          color: var(--bs-secondary-color);
        }
        
        .rich-text-preview .wmde-markdown {
          background-color: transparent !important;
          color: inherit !important;
          font-family: inherit !important;
          font-size: 14px;
        }
        
        .rich-text-preview .wmde-markdown p {
          margin-bottom: 0.5rem;
        }
        
        .rich-text-preview .wmde-markdown h1,
        .rich-text-preview .wmde-markdown h2,
        .rich-text-preview .wmde-markdown h3 {
          margin-bottom: 0.75rem;
          margin-top: 0.5rem;
        }
        
        .rich-text-preview .wmde-markdown ul,
        .rich-text-preview .wmde-markdown ol {
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }
        
        .rich-text-preview .wmde-markdown blockquote {
          border-left: 4px solid var(--bs-primary);
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: var(--bs-secondary-color);
        }
        
        .rich-text-preview .wmde-markdown code {
          background-color: var(--bs-secondary-bg);
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        
        .rich-text-preview .wmde-markdown pre {
          background-color: var(--bs-secondary-bg);
          padding: 0.75rem;
          border-radius: 0.375rem;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};