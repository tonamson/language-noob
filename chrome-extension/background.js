/**
 * Language Noob - Background Service Worker
 * Xử lý API calls để dịch văn bản
 */

// Default API URL
const DEFAULT_API_URL = "http://localhost:2053";

/**
 * Lấy API URL từ storage hoặc dùng default
 */
async function getApiUrl() {
  try {
    const result = await chrome.storage.local.get(["apiUrl"]);
    return result.apiUrl || DEFAULT_API_URL;
  } catch (error) {
    console.error("Lỗi đọc storage:", error);
    return DEFAULT_API_URL;
  }
}

/**
 * Gọi API dịch văn bản
 * @param {string} text - Văn bản cần dịch
 * @returns {Promise<{translatedText: string, error?: string}>}
 */
async function translateText(text) {
  const apiUrl = await getApiUrl();

  try {
    const response = await fetch(`${apiUrl}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: text,
        targetLanguage: "Tiếng Việt",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { translatedText: data.translatedText };
  } catch (error) {
    console.error("Lỗi gọi API:", error);
    return { error: error.message };
  }
}

/**
 * Dịch nhiều đoạn văn bản cùng lúc (batch)
 * Gộp các text thành JSON object để giảm số lần gọi API
 */
async function translateBatch(texts) {
  const apiUrl = await getApiUrl();

  // Tạo JSON object với index làm key
  const inputJson = {};
  texts.forEach((text, index) => {
    if (text && text.trim()) {
      inputJson[index.toString()] = text.trim();
    }
  });

  if (Object.keys(inputJson).length === 0) {
    return { translations: {} };
  }

  try {
    // Gọi API với batch prompt
    const batchPrompt = JSON.stringify(inputJson);

    const response = await fetch(`${apiUrl}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Dịch JSON sau sang Tiếng Việt, giữ nguyên keys, chỉ trả về JSON:
${batchPrompt}`,
        targetLanguage: "Tiếng Việt",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Parse JSON từ response
    try {
      const jsonMatch = data.translatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const translations = JSON.parse(jsonMatch[0]);
        return { translations };
      }
    } catch (e) {
      console.warn("Không parse được JSON, fallback về dịch từng phần");
    }

    return { translations: {}, error: "Parse error" };
  } catch (error) {
    console.error("Lỗi batch translate:", error);
    return { translations: {}, error: error.message };
  }
}

// Lắng nghe messages từ content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    translateText(request.text)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Async response
  }

  if (request.action === "translateBatch") {
    translateBatch(request.texts)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ translations: {}, error: error.message })
      );
    return true; // Async response
  }

  if (request.action === "getApiUrl") {
    getApiUrl()
      .then((apiUrl) => sendResponse({ apiUrl }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

console.log("Language Noob Background Service Worker loaded");
