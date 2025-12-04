import { ApiClientService } from "./api-client.service";

/**
 * Interface cho bounding box của text trong ảnh
 */
export interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Interface cho kết quả dịch từng block text
 */
export interface TranslatedBlock {
  box: TextBox;
  originalText: string;
  translatedText: string;
  confidence: number;
}

/**
 * DTO cho response dịch ảnh
 */
export interface ImageTranslateResponse {
  blocks: TranslatedBlock[];
  totalDuration: number;
  ocrDuration: number;
  translateDuration: number;
  translateModel: string;
}

/**
 * Custom error cho dịch ảnh
 */
export class ImageTranslateError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "ImageTranslateError";
  }
}

/**
 * Service xử lý dịch ảnh qua API
 */
export class ImageTranslateService extends ApiClientService {
  private static instance: ImageTranslateService;

  private constructor() {
    super();
  }

  static getInstance(): ImageTranslateService {
    if (!ImageTranslateService.instance) {
      ImageTranslateService.instance = new ImageTranslateService();
    }
    return ImageTranslateService.instance;
  }

  /**
   * Dịch ảnh qua API
   * @param imageBlob Blob hoặc File của ảnh
   * @param sourceLanguage Ngôn ngữ nguồn (tùy chọn)
   * @param targetLanguage Ngôn ngữ đích (mặc định Tiếng Việt)
   * @returns Kết quả dịch ảnh
   */
  async translateImage(
    imageBlob: Blob,
    sourceLanguage?: string,
    targetLanguage: string = "Tiếng Việt"
  ): Promise<ImageTranslateResponse> {
    try {
      const formData = new FormData();
      formData.append("image", imageBlob);
      if (sourceLanguage) {
        formData.append("sourceLanguage", sourceLanguage);
      }
      formData.append("targetLanguage", targetLanguage);

      const response = await this.apiClient.post<ImageTranslateResponse>(
        "/translate/image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data;
    } catch (error) {
      this.handleError(
        error,
        "Đã xảy ra lỗi khi dịch ảnh.",
        ImageTranslateError
      );
    }
  }

  /**
   * Static method để dễ sử dụng
   */
  static async translateImage(
    imageBlob: Blob,
    sourceLanguage?: string,
    targetLanguage?: string
  ): Promise<ImageTranslateResponse> {
    return ImageTranslateService.getInstance().translateImage(
      imageBlob,
      sourceLanguage,
      targetLanguage
    );
  }
}
