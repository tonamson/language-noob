import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsIn,
} from 'class-validator';

/**
 * Danh sách ngôn ngữ được hỗ trợ
 */
export const SUPPORTED_LANGUAGES = [
  'Tiếng Việt',
  'English',
  '中文',
  '日本語',
  '한국어',
  'Français',
  'Deutsch',
  'Español',
  'Italiano',
  'Português',
  'Русский',
  'العربية',
  'ไทย',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * DTO cho request dịch thuật
 * Hỗ trợ dịch từ ngôn ngữ A sang ngôn ngữ B
 */
export class TranslateRequestDto {
  /**
   * Nội dung văn bản cần dịch (prompt)
   * @example "Hello, how are you?"
   */
  @IsString({ message: 'Prompt phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Prompt không được để trống' })
  @MinLength(1, { message: 'Prompt phải có ít nhất 1 ký tự' })
  prompt: string;

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
