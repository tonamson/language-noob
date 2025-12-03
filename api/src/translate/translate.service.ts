import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TranslateRequestDto } from './dto/translate-request.dto';
import {
  TranslateResponseDto,
  OllamaChatResponse,
} from './dto/translate-response.dto';
import { ConfigService } from '@nestjs/config';

/**
 * Service xử lý logic dịch thuật thông qua Ollama API
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private ollamaApiUrl: string;
  private readonly model = 'qwen3:8b';
  private readonly think = false;
  private readonly stream = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.ollamaApiUrl =
      configService.get<string>('OLLAMA_API_URL') || 'http://localhost:11434';
  }

  /**
   * Tạo prompt system message dựa trên source và target language
   * @param sourceLanguage Ngôn ngữ nguồn (null nếu tự phát hiện)
   * @param targetLanguage Ngôn ngữ đích (mặc định Tiếng Việt)
   * @returns System prompt message
   */
  private buildSystemPrompt(
    sourceLanguage?: string,
    targetLanguage: string = 'Tiếng Việt',
  ): string {
    const basePrompt = sourceLanguage
      ? `Dịch văn bản từ ${sourceLanguage} sang ${targetLanguage}.`
      : `Tự động phát hiện ngôn ngữ và dịch sang ${targetLanguage}.`;

    return `Bạn là chuyên gia dịch thuật. ${basePrompt}
YÊU CẦU:
- CHỈ trả về bản dịch, không giải thích.
- GIỮ NGUYÊN định dạng: xuống dòng, đoạn văn, danh sách.
- Dịch tự nhiên, phù hợp văn hóa ${targetLanguage}.`;
  }

  /**
   * Tính num_ctx tối ưu dựa trên độ dài prompt
   * @param text User prompt
   * @returns num_ctx phù hợp (min 512, max 4096)
   */
  private calculateNumCtx(text: string): number {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    // Base 512 + 2 tokens/từ (ước tính), giới hạn 512-4096
    return Math.min(Math.max(512 + wordCount * 2, 512), 4096);
  }

  /**
   * Gọi Ollama Chat API để dịch văn bản
   * @param systemPrompt System prompt cho model
   * @param userPrompt User prompt cần dịch
   * @returns Response data từ Ollama API
   */
  private async callOllamaChatAPI(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<OllamaChatResponse> {
    const numCtx = this.calculateNumCtx(userPrompt);

    const response = await firstValueFrom(
      this.httpService.post<OllamaChatResponse>(
        `${this.ollamaApiUrl}/api/chat`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt.trim() },
          ],
          stream: this.stream,
          think: this.think,
          options: {
            temperature: 0.1,
            num_ctx: numCtx,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      ),
    );
    return response.data;
  }

  /**
   * Xử lý lỗi từ Ollama API và throw HttpException phù hợp
   * @param error Lỗi từ axios
   * @param duration Thời gian đã xử lý (ms)
   */
  private handleOllamaError(error: any, duration: number): never {
    this.logger.error(`Lỗi khi dịch văn bản sau ${duration}ms:`, error);

    if (error.response) {
      throw new HttpException(
        {
          message: 'Lỗi khi gọi Ollama API',
          error: error.response.data || error.message,
          statusCode: error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        },
        error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (error.request) {
      throw new HttpException(
        {
          message:
            'Không thể kết nối đến Ollama API. Vui lòng kiểm tra Ollama đã chạy chưa.',
          error: 'Connection timeout or Ollama service unavailable',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new HttpException(
      {
        message: 'Lỗi không xác định khi dịch văn bản',
        error: error.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Trích xuất translated text từ Ollama response
   * @param response Response từ Ollama API
   * @returns Translated text
   */
  private extractTranslatedText(response: OllamaChatResponse): string {
    return (
      response.message?.content ||
      (typeof response.message === 'string' ? response.message : '')
    );
  }

  /**
   * Dịch văn bản thông qua Ollama API
   * Hỗ trợ dịch từ ngôn ngữ A sang ngôn ngữ B
   * @param translateRequestDto Dữ liệu request chứa prompt, sourceLanguage và targetLanguage
   * @returns Kết quả dịch thuật
   * @throws HttpException Nếu có lỗi khi gọi Ollama API
   */
  async translate(
    translateRequestDto: TranslateRequestDto,
  ): Promise<TranslateResponseDto> {
    const startTime = Date.now();
    const {
      prompt,
      sourceLanguage,
      targetLanguage = 'Tiếng Việt',
    } = translateRequestDto;

    try {
      const systemPrompt = this.buildSystemPrompt(
        sourceLanguage,
        targetLanguage,
      );

      this.logger.log(
        `Dịch từ ${sourceLanguage || 'tự phát hiện'} sang ${targetLanguage}`,
      );

      const response = await this.callOllamaChatAPI(systemPrompt, prompt);
      const translatedText = this.extractTranslatedText(response);
      const duration = Date.now() - startTime;

      this.logger.log(`Dịch thành công trong ${duration}ms`);

      return {
        translatedText,
        model: response.model || this.model,
        duration,
      };
    } catch (error) {
      this.handleOllamaError(error, Date.now() - startTime);
    }
  }
}
