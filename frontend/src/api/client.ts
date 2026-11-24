import axios from 'axios';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: { user?: { id: number; username?: string } };
        ready(): void;
        expand(): void;
        BackButton: { show(): void; hide(): void; onClick(fn: () => void): void };
        MainButton: { text: string; show(): void; hide(): void; onClick(fn: () => void): void };
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        HapticFeedback?: {
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
        };
        setHeaderColor?(color: string): void;
        isVersionAtLeast?(version: string): boolean;
        downloadFile?(params: { url: string; file_name: string }): void;
        openLink?(url: string): void;
        setBackgroundColor?(color: string): void;
      };
    };
  }
}

export const tg = window.Telegram?.WebApp;

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30_000,
});

// Attach Telegram init data to every request
api.interceptors.request.use((config) => {
  const initData = tg?.initData;
  if (initData) {
    config.headers['X-Tg-Init-Data'] = initData;
  }
  // Dev bypass: set DEV_TG_ID in localStorage
  const devId = localStorage.getItem('DEV_TG_ID');
  if (devId) {
    config.headers['X-Dev-Tg-Id'] = devId;
  }
  return config;
});

export default api;
