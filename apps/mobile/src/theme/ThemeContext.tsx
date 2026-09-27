import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

export interface ThemeColors {
  bg: string;
  bgLight: string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
  danger: string;
  success: string;
  warning: string;
  purple: string;
  border: string;
}

const darkColors: ThemeColors = {
  bg: '#0A1628',
  bgLight: '#112240',
  surface: '#162035',
  accent: '#4FC3F7',
  text: '#F8FAFF',
  muted: '#8899AA',
  danger: '#FF6B6B',
  success: '#06D6A0',
  warning: '#FFD166',
  purple: '#C77DFF',
  border: 'rgba(255,255,255,0.08)',
};

const lightColors: ThemeColors = {
  bg: '#FBFAF7',
  bgLight: '#FFFFFF',
  surface: '#FFFFFF',
  accent: '#0284C7',
  text: '#0B1533',
  muted: '#667085',
  danger: '#DC2626',
  success: '#059669',
  warning: '#D97706',
  purple: '#6C43FF',
  border: 'rgba(10,22,40,0.08)',
};

interface ThemeContextValue {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  toggleTheme: () => void;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'hearth_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Hearth's redesigned consumer experience defaults to the warm light theme.
  // A saved user preference still wins after SecureStore loads.
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setMode(saved);
        }
      } catch {
        // Keep the warm light default if storage read fails for any reason
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  };

  const colors = mode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, isLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
