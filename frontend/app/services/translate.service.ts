import { ApiClientService } from "./api-client.service";

/**
 * DTO cho request dịch thuật
 */
export interface TranslateRequest {
  prompt: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

/**
 * DTO cho response dịch thuật
 */
export interface TranslateResponse {
  translatedText: string;
  model: string;
  duration?: number;
}

/**
 * DTO cho request dịch ngược
 */
export interface TranslateReverseRequest {
  prompt: string;
  targetLanguage: string;
}

/**
 * Custom error cho dịch thuật
 */
export class TranslateError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "TranslateError";
  }
}

/**
 * Service xử lý các API calls liên quan đến dịch thuật
 * Extends từ ApiClientService để tái sử dụng axios instance và các method tiện ích
 */
export class TranslateService extends ApiClientService {
  private static instance: TranslateService;

  /**
   * Singleton pattern để đảm bảo chỉ có một instance
   */
  private constructor() {
    super();
  }

  /**
   * Lấy instance của TranslateService (Singleton)
   */
  static getInstance(): TranslateService {
    if (!TranslateService.instance) {
      TranslateService.instance = new TranslateService();
    }
    return TranslateService.instance;
  }

  /**
   * Dịch văn bản thông qua API
   * @param prompt Văn bản cần dịch
   * @param sourceLanguage Ngôn ngữ nguồn (tùy chọn, nếu không có sẽ tự phát hiện)
   * @param targetLanguage Ngôn ngữ đích (tùy chọn, mặc định Tiếng Việt)
   * @returns Kết quả dịch thuật
   * @throws TranslateError Nếu có lỗi xảy ra
   */
  async translate(
    prompt: string,
    sourceLanguage?: string,
    targetLanguage?: string
  ): Promise<TranslateResponse> {
    try {
      const request: TranslateRequest = { prompt };
      if (sourceLanguage) {
        request.sourceLanguage = sourceLanguage;
      }
      if (targetLanguage) {
        request.targetLanguage = targetLanguage;
      }
      return await this.post<TranslateResponse>("/translate", request);
    } catch (error) {
      this.handleError(
        error,
        "Đã xảy ra lỗi khi dịch văn bản.",
        TranslateError
      );
    }
  }

  /**
   * Dịch ngược từ Tiếng Việt sang ngôn ngữ chỉ định
   * @param prompt Văn bản Tiếng Việt cần dịch
   * @param targetLanguage Ngôn ngữ đích muốn dịch sang
   * @returns Kết quả dịch thuật
   * @throws TranslateError Nếu có lỗi xảy ra
   */
  async translateReverse(
    prompt: string,
    targetLanguage: string
  ): Promise<TranslateResponse> {
    try {
      return await this.post<TranslateResponse>("/translate/reverse", {
        prompt,
        targetLanguage,
      });
    } catch (error) {
      this.handleError(
        error,
        "Đã xảy ra lỗi khi dịch ngược văn bản.",
        TranslateError
      );
    }
  }

  /**
   * Static method để dễ sử dụng (gọi instance method bên trong)
   */
  static async translate(
    prompt: string,
    sourceLanguage?: string,
    targetLanguage?: string
  ): Promise<TranslateResponse> {
    return TranslateService.getInstance().translate(
      prompt,
      sourceLanguage,
      targetLanguage
    );
  }

  /**
   * Static method để dịch ngược
   */
  static async translateReverse(
    prompt: string,
    targetLanguage: string
  ): Promise<TranslateResponse> {
    return TranslateService.getInstance().translateReverse(
      prompt,
      targetLanguage
    );
  }
}
