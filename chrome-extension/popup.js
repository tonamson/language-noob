/**
 * Language Noob - Popup Script
 * Quản lý cấu hình API URL
 */

const DEFAULT_API_URL = "http://localhost:2053";

document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  // Load saved API URL
  try {
    const result = await chrome.storage.local.get(["apiUrl"]);
    apiUrlInput.value = result.apiUrl || DEFAULT_API_URL;
  } catch (error) {
    apiUrlInput.value = DEFAULT_API_URL;
  }

  // Save button click handler
  saveBtn.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim();

    if (!apiUrl) {
      showStatus("Vui lòng nhập API URL!", "error");
      return;
    }

    // Validate URL format
    try {
      new URL(apiUrl);
    } catch {
      showStatus("URL không hợp lệ!", "error");
      return;
    }

    // Save to storage
    try {
      await chrome.storage.local.set({ apiUrl });
      showStatus("Đã lưu thành công! ✅", "success");
    } catch (error) {
      showStatus("Lỗi: " + error.message, "error");
    }
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = "status " + type;

    setTimeout(() => {
      status.className = "status";
    }, 3000);
  }
});
