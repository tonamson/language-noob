const { contextBridge, ipcRenderer } = require("electron");

// API URL được inject từ main.js qua environment variable API_URL
const API_URL = process.env.API_URL || "http://127.0.0.1:2053";

// Expose API URL to renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  getApiUrl: () => API_URL,

  // Screen capture API (đơn giản - chụp toàn bộ màn hình)
  getDisplays: () => ipcRenderer.invoke("get-displays"),
  startScreenCapture: (displayId, interval = 500) =>
    ipcRenderer.invoke("start-screen-capture", displayId, interval),
  stopScreenCapture: () => ipcRenderer.invoke("stop-screen-capture"),

  // Listen for screen capture frames
  onScreenCaptureFrame: (callback) => {
    ipcRenderer.on("screen-capture-frame", (event, data) => {
      callback(data);
    });
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Cũng inject trực tiếp vào window để dễ sử dụng
contextBridge.exposeInMainWorld("__API_URL__", API_URL);
