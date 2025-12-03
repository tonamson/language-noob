const { contextBridge } = require("electron");

// API URL được inject từ main.js qua environment variable API_URL
// API_URL được set từ API_LINK trong main.js (đọc từ config.json hoặc env var)

// Lấy API URL từ environment variable (được set từ main.js)
const API_URL = process.env.API_URL || "http://127.0.0.1:2053";

// Expose API URL to renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  getApiUrl: () => API_URL,
});

// Cũng inject trực tiếp vào window để dễ sử dụng
contextBridge.exposeInMainWorld("__API_URL__", API_URL);
