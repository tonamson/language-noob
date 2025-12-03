/**
 * Type definitions cho Electron API trong renderer process
 */
interface Window {
  /**
   * API URL được inject từ Electron main process
   * Chỉ có trong Electron app, không có trong browser
   */
  __API_URL__?: string;
  
  /**
   * Electron API object được expose qua contextBridge
   */
  electronAPI?: {
    getApiUrl: () => string | null;
  };
}

