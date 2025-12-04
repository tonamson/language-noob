"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ImageTranslateService, TranslatedBlock } from "../services/image-translate.service";

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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Selection box state
  const [isSelecting, setIsSelecting] = useState(false);
  const [currentBox, setCurrentBox] = useState<Omit<SelectionBox, 'id'> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Debug state
  const [debugImages, setDebugImages] = useState<CroppedDebugImage[]>([]);
  const [translatingCount, setTranslatingCount] = useState(0);

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

      // Chỉ vẽ box đang được vẽ
      if (currentBox) {
        // Tính tỷ lệ scale từ natural size sang displayed size
        const scaleX = canvas.width / img.naturalWidth;
        const scaleY = canvas.height / img.naturalHeight;

        // Scale coordinates từ natural size sang displayed size
        const x = Math.min(currentBox.startX, currentBox.endX) * scaleX;
        const y = Math.min(currentBox.startY, currentBox.endY) * scaleY;
        const width = Math.abs(currentBox.endX - currentBox.startX) * scaleX;
        const height = Math.abs(currentBox.endY - currentBox.startY) * scaleY;

        // Vẽ fill
        ctx.fillStyle = "rgba(168, 85, 247, 0.1)";
        ctx.fillRect(x, y, width, height);

        // Vẽ viền
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
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
  }, [currentBox, capturedImage]);

  const handleCaptureScreen = async () => {
    try {
      setIsCapturing(true);
      setStatus("Chọn màn hình để chụp...");

      // Kiểm tra browser hỗ trợ Screen Capture API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setStatus("Trình duyệt không hỗ trợ chụp màn hình");
        setIsCapturing(false);
        return;
      }

      // Yêu cầu quyền chụp màn hình
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "never" // Không hiển thị con trỏ chuột
        } as MediaTrackConstraints
      });

      streamRef.current = stream;
      setStatus("Đang xử lý...");

      // Tạo video element để capture frame
      const video = document.createElement("video");
      videoRef.current = video;
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;

      // Đợi video load metadata để có kích thước
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Đợi thêm một chút để đảm bảo frame đầu tiên đã sẵn sàng
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture frame từ video thành canvas
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setStatus("Lỗi: Không thể tạo canvas context");
        setIsCapturing(false);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas thành data URL
      const imageData = canvas.toDataURL("image/png");

      // Dừng stream ngay sau khi capture
      stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      videoRef.current = null;

      // Lưu ảnh đã chụp
      setCapturedImage(imageData);
      setCurrentBox(null);
      setStatus("Đã chụp màn hình. Vẽ box để tự động dịch vùng đó.");

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setStatus("Bạn đã từ chối quyền chụp màn hình");
        } else {
          setStatus(`Lỗi: ${error.message}`);
        }
      } else {
        setStatus("Lỗi: Không thể chụp màn hình");
      }

      // Cleanup stream nếu có lỗi
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
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

  const handleMouseUp = async () => {
    if (isSelecting && currentBox && capturedImage) {
      // Chỉ xử lý box nếu có kích thước hợp lý (theo natural size)
      const width = Math.abs(currentBox.endX - currentBox.startX);
      const height = Math.abs(currentBox.endY - currentBox.startY);

      if (width > 10 && height > 10) {
        const boxToTranslate: SelectionBox = {
          id: Date.now().toString(),
          ...currentBox
        };

        // Reset currentBox ngay để không vẽ nữa
        setCurrentBox(null);
        setIsSelecting(false);

        // Tự động crop và dịch (không block UI)
        (async () => {
          try {
            setTranslatingCount(prev => {
              const newCount = prev + 1;
              setStatus(`Đang dịch... (${newCount} đang xử lý)`);
              return newCount;
            });

            // Crop image
            const croppedImage = await cropImage(capturedImage, boxToTranslate);

            // Convert base64 to blob
            const blob = await fetch(croppedImage).then((res) => res.blob());

            // Gọi API dịch
            const result = await ImageTranslateService.translateImage(blob);

            // Thêm vào debug images
            const newDebugImage: CroppedDebugImage = {
              id: boxToTranslate.id,
              boxId: boxToTranslate.id,
              croppedImage,
              translatedBlocks: result.blocks,
              timestamp: Date.now(),
            };

            setDebugImages((prev) => [...prev, newDebugImage]);
            setTranslatingCount(prev => {
              const newCount = prev - 1;
              if (newCount === 0) {
                setStatus(`Đã dịch xong tất cả!`);
              }
              return newCount;
            });
          } catch (error) {
            setTranslatingCount(prev => prev - 1);
            console.error("Lỗi khi dịch:", error);
          }
        })();
      } else {
        setCurrentBox(null);
        setIsSelecting(false);
      }
    } else {
      setCurrentBox(null);
      setIsSelecting(false);
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
      <main className="flex flex-1 px-4 py-4 sm:px-6">
        <div className="mx-auto w-full space-y-4">
            {/* Controls - Compact */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3 p-3">
                <div className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Nhấn nút Chụp để chọn màn hình hoặc cửa sổ cần chụp
                </div>

                <button
                  onClick={handleCaptureScreen}
                  disabled={isCapturing}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Chụp Màn Hình
                </button>
              </div>

              {status && (
                <div className={`border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs ${
                  translatingCount > 0 ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" : "bg-zinc-50 text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
                }`}>
                  {status}
                </div>
              )}
            </div>

            {/* Screen Preview với Selection */}
            {capturedImage && (
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">Hướng dẫn:</span> Kéo chuột để vẽ box → Thả ra để tự động dịch
                  </p>
                </div>
                <div className="p-3">
                  <div className="relative overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700" style={{ maxHeight: "calc(100vh - 280px)" }}>
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
              </div>
            )}

            {!capturedImage && (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Nhấn &quot;Chụp Màn Hình&quot; để bắt đầu
                </p>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  Bạn sẽ được yêu cầu chọn màn hình hoặc cửa sổ muốn chụp
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
                  {[...debugImages].reverse().map((debugImg) => (
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
