"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TranslateService,
  TranslateError,
} from "../services/translate.service";

// Component hiển thị hiệu ứng typing
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        <div className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]"></div>
        <div className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]"></div>
        <div className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce"></div>
      </div>
    </div>
  );
}

// Danh sách ngôn ngữ được hỗ trợ
const SUPPORTED_LANGUAGES = [
  { value: "Tiếng Việt", label: "Tiếng Việt" },
  { value: "English", label: "Tiếng Anh" },
  { value: "中文", label: "Tiếng Trung" },
  { value: "日本語", label: "Tiếng Nhật" },
  { value: "한국어", label: "Tiếng Hàn" },
  { value: "Français", label: "Tiếng Pháp" },
  { value: "Deutsch", label: "Tiếng Đức" },
  { value: "Español", label: "Tiếng Tây Ban Nha" },
  { value: "Italiano", label: "Tiếng Ý" },
  { value: "Português", label: "Tiếng Bồ Đào Nha" },
  { value: "Русский", label: "Tiếng Nga" },
  { value: "العربية", label: "Tiếng Ả Rập" },
  { value: "ไทย", label: "Tiếng Thái" },
] as const;

type TranslateMode = "auto" | "manual";

export default function ChatPage() {
  const [messages, setMessages] = useState<
    Array<{
      id: number;
      text: string;
      sender: "user" | "assistant";
      isTyping?: boolean;
    }>
  >([]);
  const [inputText, setInputText] = useState("");
  const [translateMode, setTranslateMode] = useState<TranslateMode>("auto");
  const [targetLanguage, setTargetLanguage] = useState<string>("English");
  const [isLoading, setIsLoading] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<number | null>(null);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputText,
      sender: "user" as const,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText("");
    setIsLoading(true);

    // Thêm message typing indicator
    const typingId = Date.now() + 1;
    setTypingMessageId(typingId);
    setMessages((prev) => [
      ...prev,
      {
        id: typingId,
        text: "",
        sender: "assistant",
        isTyping: true,
      },
    ]);

    try {
      let response;
      // Gọi API dịch thuật dựa trên mode
      if (translateMode === "auto") {
        // Tự phát hiện ngôn ngữ -> dịch sang Tiếng Việt
        // Không truyền sourceLanguage để tự phát hiện, targetLanguage mặc định là Tiếng Việt
        response = await TranslateService.translate(currentInput);
      } else {
        // Ngôn ngữ muốn dịch -> dịch từ Tiếng Việt sang ngôn ngữ chỉ định
        // Truyền sourceLanguage = "Tiếng Việt" và targetLanguage = ngôn ngữ đã chọn
        response = await TranslateService.translate(
          currentInput,
          "Tiếng Việt",
          targetLanguage
        );
      }

      const translatedText = response.translatedText || currentInput;

      // Thay thế message typing bằng response thực tế
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingId
            ? {
                id: typingId,
                text: translatedText,
                sender: "assistant" as const,
                isTyping: false,
              }
            : msg
        )
      );
    } catch (error) {
      console.error("Lỗi khi dịch văn bản:", error);

      // Xử lý lỗi từ TranslateService
      const errorMessage =
        error instanceof TranslateError
          ? error.message
          : "Đã xảy ra lỗi khi dịch văn bản.";

      // Thay thế message typing bằng error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingId
            ? {
                id: typingId,
                text: `❌ ${errorMessage}`,
                sender: "assistant" as const,
                isTyping: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setTypingMessageId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Quay lại
          </Link>
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
            Dịch theo Chat
          </h1>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <svg
                      className="h-8 w-8 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {translateMode === "auto"
                      ? "Bắt đầu nhập văn bản cần dịch..."
                      : "Nhập văn bản Tiếng Việt để dịch sang ngôn ngữ đã chọn..."}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl ${
                      message.sender === "user"
                        ? "bg-blue-600 text-white px-4 py-3"
                        : message.isTyping
                        ? "bg-white dark:bg-zinc-800"
                        : "bg-white text-black px-4 py-3 dark:bg-zinc-800 dark:text-zinc-50"
                    }`}
                  >
                    {message.isTyping ? (
                      <TypingIndicator />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.text}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
            {/* Translate Mode Selection */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Chế độ dịch:
                </label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="translateMode"
                      value="auto"
                      checked={translateMode === "auto"}
                      onChange={(e) =>
                        setTranslateMode(e.target.value as TranslateMode)
                      }
                      disabled={isLoading}
                      className="h-4 w-4 cursor-pointer border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-zinc-600"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Tự phát hiện ngôn ngữ
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="translateMode"
                      value="manual"
                      checked={translateMode === "manual"}
                      onChange={(e) =>
                        setTranslateMode(e.target.value as TranslateMode)
                      }
                      disabled={isLoading}
                      className="h-4 w-4 cursor-pointer border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-zinc-600"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Ngôn ngữ muốn dịch
                    </span>
                  </label>
                </div>
              </div>

              {/* Language Selector - chỉ hiện khi chọn manual */}
              {translateMode === "manual" && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="target-language"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Sang:
                  </label>
                  <select
                    id="target-language"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    disabled={isLoading}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Input and Send Button */}
            <div className="flex gap-2 items-end">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                autoFocus
                placeholder={
                  translateMode === "auto"
                    ? "Nhập văn bản cần dịch..."
                    : "Nhập văn bản Tiếng Việt cần dịch..."
                }
                disabled={isLoading}
                rows={1}
                style={{
                  minHeight: "48px",
                  maxHeight: "200px",
                  resize: "none",
                }}
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 overflow-y-auto"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  // Tự động điều chỉnh chiều cao theo nội dung
                  target.style.height = "auto";
                  target.style.height = `${Math.min(
                    target.scrollHeight,
                    200
                  )}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                className="flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <svg
                    className="h-5 w-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
