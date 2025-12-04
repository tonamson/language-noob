"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ImageTranslateService, TranslatedBlock } from "../services/image-translate.service";

interface Display {
  id: number;
  index: number;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
  label: string;
}

interface SelectionBox {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface CroppedDebugImage {
  id: string;
  boxId: string;
  croppedImage: string;
  translatedBlocks?: TranslatedBlock[];
  timestamp: number;
}

export default function ScreenScanPage() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Selection box state
  const [isSelecting, setIsSelecting] = useState(false);
  const [currentBox, setCurrentBox] = useState<Omit<SelectionBox, 'id'> | null>(null);
  const [selectionBoxes, setSelectionBoxes] = useState<SelectionBox[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Debug state
  const [debugImages, setDebugImages] = useState<CroppedDebugImage[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) {
      return;
    }

    const electronAPI = window.electronAPI;

    electronAPI.getDisplays().then((displaysList: Display[]) => {
      setDisplays(displaysList);
      if (displaysList.length > 0) {
        setSelectedDisplayId(displaysList[0].id);
      }
    });
  }, []);

  // Vẽ selection boxes lên canvas
  useEffect(() => {
    if (!canvasRef.current || !capturedImage || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;
    if (!ctx) return;

    // Đợi image load xong
    const draw = () => {
      if (!img.naturalWidth || !canvas.width) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Tính tỷ lệ scale từ natural size sang displayed size
      const scaleX = canvas.width / img.naturalWidth;
      const scaleY = canvas.height / img.naturalHeight;

      // Hàm vẽ một box (box coordinates là theo natural size)
      const drawBox = (box: Omit<SelectionBox, 'id'>, color: string = "#a855f7", fillColor?: string) => {
        // Scale coordinates từ natural size sang displayed size
        const x = Math.min(box.startX, box.endX) * scaleX;
        const y = Math.min(box.startY, box.endY) * scaleY;
        const width = Math.abs(box.endX - box.startX) * scaleX;
        const height = Math.abs(box.endY - box.startY) * scaleY;

        // Vẽ fill nếu có
        if (fillColor) {
          ctx.fillStyle = fillColor;
          ctx.fillRect(x, y, width, height);
        }

        // Vẽ viền
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        return { x, y, width, height };
      };

      // Vẽ tất cả các boxes đã lưu
      selectionBoxes.forEach((box) => {
        const coords = drawBox(box, "#10b981", "rgba(16, 185, 129, 0.1)");

        // Vẽ nút X để xóa (góc trên phải)
        const btnSize = 24;
        const btnX = coords.x + coords.width - btnSize - 4;
        const btnY = coords.y + 4;

        // Background nút X
        ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
        ctx.fillRect(btnX, btnY, btnSize, btnSize);

        // Icon X
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(btnX + 6, btnY + 6);
        ctx.lineTo(btnX + btnSize - 6, btnY + btnSize - 6);
        ctx.moveTo(btnX + btnSize - 6, btnY + 6);
        ctx.lineTo(btnX + 6, btnY + btnSize - 6);
        ctx.stroke();
      });

      // Vẽ box đang được vẽ
      if (currentBox) {
        drawBox(currentBox, "#a855f7", "rgba(168, 85, 247, 0.1)");
      }
    };

    // Vẽ ngay nếu image đã load
    if (img.complete && img.naturalWidth) {
      draw();
    }

    // Listen for image load
    img.addEventListener('load', draw);

    // Vẽ lại khi có thay đổi
    draw();

    return () => {
      img.removeEventListener('load', draw);
    };
  }, [selectionBoxes, currentBox, capturedImage]);

  const handleCaptureScreen = async () => {
    if (!window.electronAPI) {
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

      const result = await window.electronAPI.captureScreenOnce(selectedDisplayId);

      if (result.success && result.imageData) {
        setCapturedImage(result.imageData);
        setSelectionBoxes([]);
        setCurrentBox(null);
        setStatus("Đã chụp màn hình. Vẽ nhiều box để chọn vùng cần dịch.");
      } else {
        setStatus(`Lỗi: ${result.error || "Không thể chụp màn hình"}`);
      }
    } catch (error) {
      setStatus(`Lỗi: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!capturedImage || !imageRef.current) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img.naturalWidth) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Tính tỷ lệ scale
    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;

    // Kiểm tra xem click vào nút X của box nào không
    const btnSize = 24;
    for (let i = selectionBoxes.length - 1; i >= 0; i--) {
      const box = selectionBoxes[i];
      // Box coordinates là theo natural size, cần scale để check
      const x = Math.min(box.startX, box.endX) * scaleX;
      const y = Math.min(box.startY, box.endY) * scaleY;
      const width = Math.abs(box.endX - box.startX) * scaleX;
      const height = Math.abs(box.endY - box.startY) * scaleY;

      const btnX = x + width - btnSize - 4;
      const btnY = y + 4;

      // Click vào nút X
      if (clickX >= btnX && clickX <= btnX + btnSize &&
          clickY >= btnY && clickY <= btnY + btnSize) {
        setSelectionBoxes(boxes => boxes.filter(b => b.id !== box.id));
        setStatus(`Đã xóa box`);
        return;
      }

      // Click vào box (không phải nút X) -> dịch
      if (clickX >= x && clickX <= x + width &&
          clickY >= y && clickY <= y + height) {
        handleTranslateBox(box);
        return;
      }
    }

    // Không click vào box nào -> bắt đầu vẽ box mới
    // Convert clicked coordinates sang natural size để lưu
    const naturalX = clickX / scaleX;
    const naturalY = clickY / scaleY;

    setIsSelecting(true);
    setCurrentBox({
      startX: naturalX,
      startY: naturalY,
      endX: naturalX,
      endY: naturalY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !currentBox || !imageRef.current) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img.naturalWidth) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Tính tỷ lệ scale
    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;

    // Convert sang natural coordinates
    const naturalX = x / scaleX;
    const naturalY = y / scaleY;

    setCurrentBox({
      ...currentBox,
      endX: naturalX,
      endY: naturalY,
    });
  };

  const handleMouseUp = () => {
    if (isSelecting && currentBox) {
      // Chỉ thêm box nếu có kích thước hợp lý (theo natural size)
      const width = Math.abs(currentBox.endX - currentBox.startX);
      const height = Math.abs(currentBox.endY - currentBox.startY);

      if (width > 10 && height > 10) {
        const newBox: SelectionBox = {
          id: Date.now().toString(),
          ...currentBox
        };
        setSelectionBoxes(boxes => [...boxes, newBox]);
        setStatus(`Đã thêm box. Tổng cộng: ${selectionBoxes.length + 1} box. Click vào box để dịch.`);
      }

      setCurrentBox(null);
    }
    setIsSelecting(false);
  };

  const handleTranslateBox = async (box: SelectionBox) => {
    if (!capturedImage || !imageRef.current) {
      return;
    }

    try {
      setIsTranslating(true);
      setStatus("Đang dịch...");

      // Crop image từ selection box
      const croppedImage = await cropImage(capturedImage, box);

      // Convert base64 to blob
      const blob = await fetch(croppedImage).then((res) => res.blob());

      // Gọi API dịch
      const result = await ImageTranslateService.translateImage(blob);

      // Thêm vào debug images
      const newDebugImage: CroppedDebugImage = {
        id: Date.now().toString(),
        boxId: box.id,
        croppedImage,
        translatedBlocks: result.blocks,
        timestamp: Date.now(),
      };

      setDebugImages((prev) => [...prev, newDebugImage]);
      setStatus(`Đã dịch thành công! Tìm thấy ${result.blocks.length} đoạn text.`);
    } catch (error) {
      setStatus(`Lỗi khi dịch: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClearBoxes = () => {
    if (selectionBoxes.length === 0) return;
    if (confirm(`Bạn có chắc muốn xóa tất cả ${selectionBoxes.length} box?`)) {
      setSelectionBoxes([]);
      setStatus("Đã xóa tất cả các box");
    }
  };

  const handleClearDebugImages = () => {
    if (debugImages.length === 0) return;
    if (confirm(`Bạn có chắc muốn xóa tất cả ${debugImages.length} ảnh debug?`)) {
      setDebugImages([]);
      setStatus("Đã xóa tất cả ảnh debug");
    }
  };

  const handleRemoveDebugImage = (id: string) => {
    setDebugImages(prev => prev.filter(img => img.id !== id));
  };

  const cropImage = async (imageDataUrl: string, box: SelectionBox): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        // Box coordinates đã là theo natural size của image
        const x = Math.min(box.startX, box.endX);
        const y = Math.min(box.startY, box.endY);
        const width = Math.abs(box.endX - box.startX);
        const height = Math.abs(box.endY - box.startY);

        // Set canvas size theo kích thước crop
        canvas.width = width;
        canvas.height = height;

        // Crop từ natural image (không cần scale vì coordinates đã natural)
        ctx.drawImage(
          img,
          x,
          y,
          width,
          height,
          0,
          0,
          width,
          height
        );

        resolve(canvas.toDataURL());
      };
      img.src = imageDataUrl;
    });
  };


  // Load image để set canvas size và update khi resize
  useEffect(() => {
    if (!capturedImage || !canvasRef.current || !imageRef.current) return;

    const img = imageRef.current;
    const canvas = canvasRef.current;

    const updateCanvasSize = () => {
      if (img.clientWidth && img.clientHeight) {
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
      }
    };

    // Update ngay nếu image đã load
    if (img.complete && img.clientWidth) {
      updateCanvasSize();
    }

    // Listen for image load
    img.addEventListener('load', updateCanvasSize);

    // Listen for window resize to update canvas
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });

    resizeObserver.observe(img);

    return () => {
      img.removeEventListener('load', updateCanvasSize);
      resizeObserver.disconnect();
    };
  }, [capturedImage]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </Link>
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
            Dịch Màn Hình
          </h1>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto w-full space-y-6">
            {/* Controls */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Chọn màn hình:
                  </label>
                  <select
                    value={selectedDisplayId || ""}
                    onChange={(e) => {
                      setSelectedDisplayId(Number(e.target.value));
                      setCapturedImage(null);
                      setSelectionBoxes([]);
                      setCurrentBox(null);
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {displays.map((display) => (
                      <option key={display.id} value={display.id}>
                        {display.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCaptureScreen}
                    disabled={selectedDisplayId === null || isCapturing}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Chụp Màn Hình
                  </button>

                  {selectionBoxes.length > 0 && (
                    <button
                      onClick={handleClearBoxes}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Xóa Tất Cả ({selectionBoxes.length})
                    </button>
                  )}
                </div>
              </div>

              {status && (
                <div className={`mt-4 rounded-lg px-4 py-2 text-sm ${
                  isTranslating ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {status}
                </div>
              )}
            </div>

            {/* Screen Preview với Selection */}
            {capturedImage && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Hình ảnh màn hình - Hướng dẫn sử dụng:
                  </h3>
                  <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                    <li>• Vẽ nhiều box trên ảnh để chọn vùng cần dịch</li>
                    <li>• Click vào box xanh để dịch vùng đó</li>
                    <li>• Click nút X đỏ ở góc box để xóa box</li>
                    <li>• Dùng nút "Xóa Tất Cả" để xóa toàn bộ box</li>
                  </ul>
                </div>
                <div className="relative overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700" style={{ maxHeight: "calc(100vh - 400px)" }}>
                  <img
                    ref={imageRef}
                    src={capturedImage}
                    alt="Screen capture"
                    className="w-full"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                </div>
              </div>
            )}

            {!capturedImage && (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Chọn màn hình và nhấn "Chụp Màn Hình" để bắt đầu
                </p>
              </div>
            )}

            {/* Kết quả dịch - Lịch sử */}
            {debugImages.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Kết Quả Dịch ({debugImages.length})
                  </h3>
                  <button
                    onClick={handleClearDebugImages}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
                  {debugImages.map((debugImg) => (
                    <div key={debugImg.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                      <div className="flex gap-4">
                        {/* Ảnh crop */}
                        <div className="flex-shrink-0">
                          <img
                            src={debugImg.croppedImage}
                            alt={`Cropped ${debugImg.id}`}
                            className="rounded-lg border border-zinc-200 dark:border-zinc-700 max-w-[200px] max-h-[150px] object-contain"
                          />
                        </div>

                        {/* Nội dung dịch */}
                        <div className="flex-1 min-w-0">
                          {debugImg.translatedBlocks && debugImg.translatedBlocks.length > 0 ? (
                            <div className="space-y-3">
                              {debugImg.translatedBlocks.map((block, idx) => (
                                <div key={idx} className="space-y-1">
                                  {/* Text gốc */}
                                  <div className="flex items-start gap-2">
                                    <div className="flex-shrink-0 mt-1">
                                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                      </svg>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                      {block.originalText}
                                    </p>
                                  </div>

                                  {/* Text đã dịch */}
                                  <div className="flex items-start gap-2 pl-6">
                                    <div className="flex-shrink-0 mt-1">
                                      <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                      </svg>
                                    </div>
                                    <p className="text-base text-zinc-900 dark:text-zinc-50 font-medium leading-relaxed">
                                      {block.translatedText}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                              Không tìm thấy text để dịch
                            </p>
                          )}
                        </div>

                        {/* Nút xóa */}
                        <button
                          onClick={() => handleRemoveDebugImage(debugImg.id)}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-5 h-5 text-zinc-400 hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
