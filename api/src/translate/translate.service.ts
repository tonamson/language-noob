import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TranslateRequestDto } from './dto/translate-request.dto';
import {
  TranslateResponseDto,
  OllamaChatResponse,
} from './dto/translate-response.dto';
import {
  ImageTranslateResponseDto,
  TranslatedBlock,
} from './dto/image-translate.dto';
import { ConfigService } from '@nestjs/config';
import { ImageOcrService, OcrResult } from './services/image-ocr.service';

/**
 * Service xử lý logic dịch thuật thông qua Ollama API
 * Hỗ trợ dịch text và dịch ảnh với OCR
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private ollamaApiUrl: string;
  // Dùng model nhỏ hơn để tăng tốc độ: qwen3:1.8b hoặc qwen3:4b
  private readonly translateModel = 'qwen3:8b';
  private readonly stream = false;
  private readonly think = false;
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly imageOcrService: ImageOcrService,
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
- Không dịch các từ chuyên ngành, các từ kỹ thuật.
- Dịch tự nhiên, phù hợp văn hóa ${targetLanguage}.`;
  }

  /**
   * Gọi Ollama Chat API để dịch văn bản
   */
  private async callOllamaChatAPI(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<OllamaChatResponse> {
    const response = await firstValueFrom(
      this.httpService.post<OllamaChatResponse>(
        `${this.ollamaApiUrl}/api/chat`,
        {
          model: this.translateModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt.trim() },
          ],
          stream: this.stream,
          think: this.think,
          options: {
            temperature: 0.1,
            num_ctx: 512, // Context nhỏ để nhanh hơn
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    return response.data;
  }

  /**
   * Xử lý lỗi từ Ollama API
   */
  private handleOllamaError(error: any, duration: number): never {
    this.logger.error(`Lỗi sau ${duration}ms:`, error.message);

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
          message: 'Không thể kết nối đến Ollama API',
          error: 'Connection failed',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new HttpException(
      {
        message: 'Lỗi không xác định',
        error: error.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Trích xuất và clean translated text
   */
  private extractTranslatedText(response: OllamaChatResponse): string {
    let text =
      response.message?.content ||
      (typeof response.message === 'string' ? response.message : '');

    // Loại bỏ các tag không mong muốn
    text = text
      .replace(/\s*\/no_think\s*/gi, ' ')
      .replace(/\s*\/think\s*/gi, ' ')
      .replace(/\s*<think>[\s\S]*?<\/think>\s*/gi, '')
      .trim();

    return text;
  }

  /**
   * Dịch văn bản
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
      const response = await this.callOllamaChatAPI(systemPrompt, prompt);
      const translatedText = this.extractTranslatedText(response);
      const duration = Date.now() - startTime;

      return {
        translatedText,
        model: response.model || this.translateModel,
        duration,
      };
    } catch (error) {
      this.handleOllamaError(error, Date.now() - startTime);
    }
  }

  /**
   * Dịch ảnh với OCR
   * Flow: Tesseract.js detect text → Dịch text → Trả về với box coordinates
   */
  async translateImage(
    imageBuffer: Buffer,
    sourceLanguage?: string,
    targetLanguage: string = 'Tiếng Việt',
  ): Promise<ImageTranslateResponseDto> {
    const startTime = Date.now();

    try {
      // OCR detect text
      const ocrStartTime = Date.now();
      const ocrResults =
        await this.imageOcrService.detectTextBlocks(imageBuffer);
      const ocrDuration = Date.now() - ocrStartTime;

      this.logger.log(
        `OCR: ${ocrResults.length} blocks trong ${ocrDuration}ms`,
      );

      if (ocrResults.length === 0) {
        return {
          blocks: [],
          totalDuration: Date.now() - startTime,
          ocrDuration,
          translateDuration: 0,
          translateModel: this.translateModel,
        };
      }

      // Dịch song song tất cả blocks
      const translateStartTime = Date.now();
      const translatedBlocks = await this.translateBlocksParallel(
        ocrResults,
        sourceLanguage,
        targetLanguage,
      );
      const translateDuration = Date.now() - translateStartTime;

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `Hoàn thành: ${translatedBlocks.length} blocks trong ${totalDuration}ms`,
      );

      return {
        blocks: translatedBlocks,
        totalDuration,
        ocrDuration,
        translateDuration,
        translateModel: this.translateModel,
      };
    } catch (error) {
      this.handleOllamaError(error, Date.now() - startTime);
    }
  }

  /**
   * Dịch song song tất cả blocks để tối đa tốc độ
   */
  private async translateBlocksParallel(
    ocrResults: OcrResult[],
    sourceLanguage?: string,
    targetLanguage: string = 'Tiếng Việt',
  ): Promise<TranslatedBlock[]> {
    const systemPrompt = this.buildSystemPrompt(sourceLanguage, targetLanguage);

    // Dịch TẤT CẢ blocks cùng lúc
    const promises = ocrResults.map(async (ocrResult) => {
      const text = ocrResult.text?.trim();
      if (!text) return null;

      try {
        const response = await this.callOllamaChatAPI(systemPrompt, text);
        const translatedText = this.extractTranslatedText(response);

        this.logger.debug(`Dịch: "${text}" → "${translatedText}"`);

        return {
          box: ocrResult.box,
          originalText: text,
          translatedText,
          confidence: ocrResult.confidence,
        };
      } catch (error: any) {
        // Log lỗi chi tiết để debug
        this.logger.error(`Lỗi dịch "${text}": ${error.message}`);

        // Trả về text gốc nếu dịch thất bại
        return {
          box: ocrResult.box,
          originalText: text,
          translatedText: text,
          confidence: ocrResult.confidence,
        };
      }
    });

    const results = await Promise.allSettled(promises);

    return results
      .filter(
        (r): r is PromiseFulfilledResult<TranslatedBlock | null> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value as TranslatedBlock);
  }
}
