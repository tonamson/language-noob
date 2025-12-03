import { IsString, IsNotEmpty, MinLength, IsIn } from 'class-validator';

/**
 * Danh sách ngôn ngữ được hỗ trợ dịch ngược
 */
export const SUPPORTED_LANGUAGES = [
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
 * DTO cho request dịch ngược từ Tiếng Việt sang ngôn ngữ khác
 */
export class TranslateReverseRequestDto {
  /**
   * Nội dung văn bản Tiếng Việt cần dịch
   * @example "Xin chào, bạn khỏe không?"
   */
  @IsString({ message: 'Prompt phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Prompt không được để trống' })
  @MinLength(1, { message: 'Prompt phải có ít nhất 1 ký tự' })
  prompt: string;

  /**
   * Ngôn ngữ đích muốn dịch sang
   * @example "English"
   */
  @IsString({ message: 'Target language phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Target language không được để trống' })
  @IsIn(SUPPORTED_LANGUAGES, {
    message: `Target language phải là một trong các ngôn ngữ: ${SUPPORTED_LANGUAGES.join(', ')}`,
  })
  targetLanguage: SupportedLanguage;
}
