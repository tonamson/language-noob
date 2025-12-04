/**
 * Type definitions cho Electron API trong renderer process
 */

interface Display {
  id: number;
  index: number;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
  label: string;
}

interface CaptureResult {
  success: boolean;
  imageData?: string;
  displayId?: number;
  error?: string;
}

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

    // Screen capture APIs
    getDisplays: () => Promise<Display[]>;
    captureScreenOnce: (displayId: number) => Promise<CaptureResult>;
    startScreenCapture: (displayId: number, interval?: number) => Promise<{ success: boolean; error?: string }>;
    stopScreenCapture: () => Promise<{ success: boolean; error?: string }>;
    onScreenCaptureFrame: (callback: (data: { imageData: string; displayId: number }) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
}

