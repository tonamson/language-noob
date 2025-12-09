/**
 * Language Noob - Content Script
 * Inject floating translate button và xử lý dịch trang web
 */

(function () {
  "use strict";

  // Tránh inject nhiều lần
  if (window.__languageNoobInjected) return;
  window.__languageNoobInjected = true;

  // Load FontAwesome 7.1 CSS với đường dẫn chính xác từ extension
  const faLink = document.createElement("link");
  faLink.rel = "stylesheet";
  faLink.href = chrome.runtime.getURL(
    "fontawesome-free-7.1.0-web/css/all.min.css"
  );
  document.head.appendChild(faLink);

  // State
  let isTranslating = false;
  let originalTexts = new Map(); // Lưu text gốc để hoàn tác
  let isTranslated = false;

  // Tạo floating button
  const floatingButton = document.createElement("div");
  floatingButton.id = "language-noob-btn";
  floatingButton.innerHTML = '<i class="fa-solid fa-globe"></i>';
  floatingButton.title = "Dịch sang Tiếng Việt";
  document.body.appendChild(floatingButton);

  // Tạo status toast
  const toast = document.createElement("div");
  toast.id = "language-noob-toast";
  document.body.appendChild(toast);

  // Tạo undo button (ẩn mặc định)
  const undoButton = document.createElement("div");
  undoButton.id = "language-noob-undo";
  undoButton.innerHTML = '<i class="fa-solid fa-arrow-rotate-left"></i>';
  undoButton.title = "Hoàn tác - Khôi phục text gốc";
  undoButton.style.display = "none";
  document.body.appendChild(undoButton);

  /**
   * Hiển thị toast notification
   */
  function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  /**
   * Lấy tất cả text nodes cần dịch
   * Bỏ qua: script, style, noscript, code, pre, textarea, input
   */
  function getTextNodes() {
    const skipTags = [
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "CODE",
      "PRE",
      "TEXTAREA",
      "INPUT",
      "SVG",
      "PATH",
      "IFRAME",
    ];
    const textNodes = [];

    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        // Chỉ lấy text có nội dung thực sự (không chỉ whitespace, numbers, symbols)
        if (
          text &&
          text.length > 1 &&
          /[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(text)
        ) {
          textNodes.push(node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (!skipTags.includes(node.tagName)) {
          for (const child of node.childNodes) {
            traverse(child);
          }
        }
      }
    }

    traverse(document.body);
    return textNodes;
  }

  /**
   * Dịch trang theo batch
   */
  async function translatePage() {
    if (isTranslating) return;

    isTranslating = true;
    floatingButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    floatingButton.classList.add("loading");
    showToast("Đang dịch trang...", 60000);

    try {
      const textNodes = getTextNodes();

      if (textNodes.length === 0) {
        showToast("Không tìm thấy text để dịch!");
        return;
      }

      showToast(`Đang dịch ${textNodes.length} đoạn văn bản...`, 60000);

      // Lưu text gốc
      originalTexts.clear();
      textNodes.forEach((node, index) => {
        originalTexts.set(index, {
          node: node,
          text: node.textContent,
        });
      });

      // Chia thành batches (mỗi batch tối đa 20 items)
      const BATCH_SIZE = 20;
      const batches = [];
      for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
        batches.push(textNodes.slice(i, i + BATCH_SIZE));
      }

      let translatedCount = 0;

      // Xử lý từng batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const texts = batch.map((node) => node.textContent.trim());

        // Gửi batch đến background script
        const response = await chrome.runtime.sendMessage({
          action: "translateBatch",
          texts: texts,
        });

        if (
          response.translations &&
          Object.keys(response.translations).length > 0
        ) {
          // Áp dụng bản dịch
          batch.forEach((node, index) => {
            const translated = response.translations[index.toString()];
            if (translated) {
              node.textContent = translated;
              translatedCount++;
            }
          });
        }

        // Update progress
        const progress = Math.round(((batchIndex + 1) / batches.length) * 100);
        showToast(`Đang dịch... ${progress}%`, 60000);
      }

      isTranslated = true;
      floatingButton.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
      undoButton.style.display = "flex";
      showToast(`Đã dịch xong ${translatedCount}/${textNodes.length} đoạn!`);
    } catch (error) {
      console.error("Lỗi dịch trang:", error);
      showToast("Lỗi: " + error.message);
      floatingButton.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    } finally {
      isTranslating = false;
      floatingButton.classList.remove("loading");
      setTimeout(() => {
        if (!isTranslating) {
          floatingButton.innerHTML = isTranslated
            ? '<i class="fa-solid fa-circle-check"></i>'
            : '<i class="fa-solid fa-globe"></i>';
        }
      }, 2000);
    }
  }

  /**
   * Hoàn tác - khôi phục text gốc
   */
  function undoTranslation() {
    if (!isTranslated || originalTexts.size === 0) return;

    originalTexts.forEach(({ node, text }) => {
      node.textContent = text;
    });

    originalTexts.clear();
    isTranslated = false;
    undoButton.style.display = "none";
    floatingButton.innerHTML = '<i class="fa-solid fa-globe"></i>';
    showToast("Đã khôi phục text gốc!");
  }

  // Event listeners
  floatingButton.addEventListener("click", translatePage);
  undoButton.addEventListener("click", undoTranslation);

  console.log("Language Noob Content Script loaded");
})();
