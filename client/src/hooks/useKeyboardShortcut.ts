import { useEffect } from 'react';

export const useKeyboardShortcut = (key: string, callback: () => void, ctrlKey = false) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === key.toLowerCase()) {
        if (ctrlKey && !event.ctrlKey) return;
        if (!ctrlKey && event.ctrlKey) return;
        
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, ctrlKey]);
};