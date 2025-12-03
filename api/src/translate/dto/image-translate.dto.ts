import { IsOptional, IsString, IsIn, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { SUPPORTED_LANGUAGES } from './translate-request.dto';
import type { SupportedLanguage } from './translate-request.dto';

/**
 * DTO cho request dịch ảnh
 * Nhận ảnh qua form-data và trả về text đã dịch với vị trí box
 */
export class ImageTranslateRequestDto {
  /**
   * Ngôn ngữ nguồn (tùy chọn, nếu không có sẽ tự phát hiện)
   * @example "English"
   */
  @IsOptional()
  @IsString({ message: 'Source language phải là chuỗi ký tự' })
  @IsIn(SUPPORTED_LANGUAGES, {
    message: `Source language phải là một trong các ngôn ngữ: ${SUPPORTED_LANGUAGES.join(', ')}`,
  })
  sourceLanguage?: SupportedLanguage;

  /**
   * Ngôn ngữ đích (tùy chọn, mặc định là Tiếng Việt)
   * @example "Tiếng Việt"
   */
  @IsOptional()
  @IsString({ message: 'Target language phải là chuỗi ký tự' })
  @IsIn(SUPPORTED_LANGUAGES, {
    message: `Target language phải là một trong các ngôn ngữ: ${SUPPORTED_LANGUAGES.join(', ')}`,
  })
  targetLanguage?: SupportedLanguage;
}

/**
 * Interface cho bounding box của text trong ảnh
 */
export interface TextBox {
  /** Tọa độ x của góc trái trên */
  x: number;
  /** Tọa độ y của góc trái trên */
  y: number;
  /** Chiều rộng của box */
  width: number;
  /** Chiều cao của box */
  height: number;
}

/**
 * Interface cho kết quả dịch từng block text
 */
export interface TranslatedBlock {
  /** Bounding box của text trong ảnh */
  box: TextBox;
  /** Text gốc từ ảnh */
  originalText: string;
  /** Text đã dịch */
  translatedText: string;
  /** Độ tin cậy của OCR (0-100) */
  confidence: number;
}

/**
 * DTO cho response dịch ảnh
 */
export class ImageTranslateResponseDto {
  /** Danh sách các block text đã dịch */
  blocks: TranslatedBlock[];

  /** Tổng thời gian xử lý (ms) */
  totalDuration: number;

  /** Thời gian OCR (ms) */
  ocrDuration: number;

  /** Thời gian dịch (ms) */
  translateDuration: number;

  /** Model dịch được sử dụng */
  translateModel: string;
}
