"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Display {
  id: number;
  index: number;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
  label: string;
}

export default function ScreenScanPage() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(
    null
  );
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Chỉ chạy trong Electron
    if (typeof window === "undefined" || !(window as any).electronAPI) {
      return;
    }

    const electronAPI = (window as any).electronAPI;

    // Lấy danh sách displays
    electronAPI.getDisplays().then((displaysList: Display[]) => {
      setDisplays(displaysList);
      if (displaysList.length > 0) {
        setSelectedDisplayId(displaysList[0].id);
      }
    });

    // Listen for screen capture frames
    electronAPI.onScreenCaptureFrame(
      (data: { imageData: string; displayId: number }) => {
        if (data.imageData) {
          setCapturedImage(data.imageData);
        }
      }
    );

    // Cleanup
    return () => {
      electronAPI.removeAllListeners("screen-capture-frame");

      // Stop capture khi component unmount
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        (window as any).electronAPI.stopScreenCapture();
      }
    };
  }, []);

  const handleStartCapture = async () => {
    if (typeof window === "undefined" || !(window as any).electronAPI) {
      alert("Tính năng này chỉ hoạt động trong Electron app");
      return;
    }

    if (selectedDisplayId === null) {
      setStatus("Vui lòng chọn màn hình trước");
      return;
    }

    try {
      setIsCapturing(true);
      setStatus("Đang chụp màn hình...");

      const result = await (window as any).electronAPI.startScreenCapture(
        selectedDisplayId,
        500 // Chụp mỗi 500ms
      );

      if (result.success) {
        setStatus("Đang chụp màn hình real-time");
      } else {
        setIsCapturing(false);
        setStatus(`Lỗi: ${result.error || "Không thể bắt đầu chụp màn hình"}`);
      }
    } catch (error) {
      setIsCapturing(false);
      setStatus(
        `Lỗi: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleStopCapture = async () => {
    if (typeof window === "undefined" || !(window as any).electronAPI) {
      return;
    }

    try {
      await (window as any).electronAPI.stopScreenCapture();
      setIsCapturing(false);
      setStatus("Đã dừng chụp màn hình");
    } catch (error) {
      console.error("Error stopping capture:", error);
    }
  };

  // Lấy thông tin display đang chọn
  const selectedDisplay = displays.find((d) => d.id === selectedDisplayId);

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
            Chụp Màn hình
          </h1>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-4xl space-y-6">
          {/* Controls */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-4">
              {/* Display Selection */}
              <div className="flex-1 min-w-[200px]">
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Chọn màn hình:
                </label>
                <select
                  value={selectedDisplayId || ""}
                  onChange={(e) => {
                    setSelectedDisplayId(Number(e.target.value));
                    setCapturedImage(null); // Clear hình cũ khi đổi màn hình
                  }}
                  disabled={isCapturing}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  {displays.map((display) => (
                    <option key={display.id} value={display.id}>
                      {display.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!isCapturing ? (
                  <button
                    onClick={handleStartCapture}
                    disabled={selectedDisplayId === null}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Bắt đầu chụp
                  </button>
                ) : (
                  <button
                    onClick={handleStopCapture}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
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
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                      />
                    </svg>
                    Dừng chụp
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            {status && (
              <div
                className={`mt-4 rounded-lg px-4 py-2 text-sm ${
                  isCapturing
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCapturing && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                  )}
                  {status}
                  {isCapturing && selectedDisplay && (
                    <span className="ml-auto text-xs opacity-70">
                      {selectedDisplay.size.width} x{" "}
                      {selectedDisplay.size.height}px
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Screen Preview */}
          {capturedImage && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {isCapturing ? "Màn hình đang chụp" : "Hình ảnh màn hình"}
                </h3>
                {isCapturing && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                    Live - 500ms
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                <img
                  src={capturedImage}
                  alt="Screen capture"
                  className="w-full"
                  style={{
                    maxHeight: "70vh",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
          )}

          {/* Empty State */}
          {!capturedImage && !isCapturing && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Chọn màn hình và nhấn "Bắt đầu chụp" để xem màn hình real-time
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
