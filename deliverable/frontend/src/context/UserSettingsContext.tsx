import React, { createContext, useState, useContext, useEffect } from 'react';

interface UserSettings {
  // Chat display settings
  showToolParameters: boolean;
  collapseThinkingByDefault: boolean;
  showTimestamps: boolean;
  // Theme settings (can be expanded later)
  theme: 'light' | 'dark' | 'system';
}

interface UserSettingsContextType {
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => void;
}

const defaultSettings: UserSettings = {
  showToolParameters: true,
  collapseThinkingByDefault: false,
  showTimestamps: true,
  theme: 'dark',
};

const LOCAL_STORAGE_KEY = 'codeAgent_userSettings';

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
});

export const useUserSettings = () => useContext(UserSettingsContext);

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from localStorage on initial render
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings(prevSettings => ({ ...prevSettings, ...parsedSettings }));
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save settings to localStorage whenever they change (but skip the first render)
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save user settings:', error);
      }
    }
  }, [settings, isInitialized]);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings,
    }));
  };

  return (
    <UserSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </UserSettingsContext.Provider>
  );
}; 