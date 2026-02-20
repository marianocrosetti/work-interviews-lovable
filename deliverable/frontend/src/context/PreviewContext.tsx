import React, { createContext, useContext, useState, useCallback } from 'react';

interface PreviewContextType {
  refreshCounter: number;
  triggerRefresh: () => void;
  previewPath: string;
  setPreviewPath: (path: string) => void;
}

const PreviewContext = createContext<PreviewContextType>({
  refreshCounter: 0,
  triggerRefresh: () => {},
  previewPath: '/',
  setPreviewPath: () => {},
});

export const usePreviewContext = () => useContext(PreviewContext);

export const PreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [previewPath, setPreviewPath] = useState('/');

  const triggerRefresh = useCallback(() => {
    setRefreshCounter(prev => prev + 1);
  }, []);

  return (
    <PreviewContext.Provider
      value={{
        refreshCounter,
        triggerRefresh,
        previewPath,
        setPreviewPath,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}; 