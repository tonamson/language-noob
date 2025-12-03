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
   * Dịch theo batch để tối ưu tốc độ
   * Chia thành các batch nhỏ, mỗi batch dịch qua 1 request JSON
   */
  private async translateBlocksParallel(
    ocrResults: OcrResult[],
    sourceLanguage?: string,
    targetLanguage: string = 'Tiếng Việt',
  ): Promise<TranslatedBlock[]> {
    const BATCH_SIZE = 20; // Số items mỗi batch
    const batches: OcrResult[][] = [];

    // Chia thành các batches
    for (let i = 0; i < ocrResults.length; i += BATCH_SIZE) {
      batches.push(ocrResults.slice(i, i + BATCH_SIZE));
    }

    this.logger.log(
      `Chia ${ocrResults.length} blocks thành ${batches.length} batches`,
    );

    // Xử lý song song các batches
    const batchPromises = batches.map((batch, batchIndex) =>
      this.translateBatch(batch, batchIndex, sourceLanguage, targetLanguage),
    );

    const batchResults = await Promise.allSettled(batchPromises);

    // Gom kết quả từ tất cả batches
    const allResults: TranslatedBlock[] = [];
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      }
    }

    return allResults;
  }

  /**
   * Dịch 1 batch sử dụng JSON format
   */
  private async translateBatch(
    batch: OcrResult[],
    batchIndex: number,
    sourceLanguage?: string,
    targetLanguage: string = 'Tiếng Việt',
  ): Promise<TranslatedBlock[]> {
    // Tạo JSON input với index làm key
    const inputJson: Record<string, string> = {};
    const validItems: { index: number; ocrResult: OcrResult }[] = [];

    batch.forEach((ocrResult, idx) => {
      const text = ocrResult.text?.trim();
      if (text) {
        inputJson[idx.toString()] = text;
        validItems.push({ index: idx, ocrResult });
      }
    });

    if (validItems.length === 0) {
      return [];
    }

    const batchSystemPrompt = this.buildBatchSystemPrompt(
      sourceLanguage,
      targetLanguage,
    );

    try {
      const response = await this.callOllamaChatAPI(
        batchSystemPrompt,
        JSON.stringify(inputJson),
      );
      const responseText = this.extractTranslatedText(response);

      // Parse JSON response
      const translatedJson = this.parseJsonResponse(responseText);

      this.logger.debug(`Batch ${batchIndex}: Dịch ${validItems.length} items`);

      // Map kết quả với box
      return validItems.map(({ index, ocrResult }) => {
        const translatedText =
          translatedJson[index.toString()] || ocrResult.text;
        return {
          box: ocrResult.box,
          originalText: ocrResult.text || '',
          translatedText,
          confidence: ocrResult.confidence,
        };
      });
    } catch (error: any) {
      this.logger.error(`Batch ${batchIndex} lỗi: ${error.message}`);
      // Fallback: trả về text gốc cho tất cả items trong batch
      return validItems.map(({ ocrResult }) => ({
        box: ocrResult.box,
        originalText: ocrResult.text || '',
        translatedText: ocrResult.text || '',
        confidence: ocrResult.confidence,
      }));
    }
  }

  /**
   * System prompt cho batch translation với JSON format
   */
  private buildBatchSystemPrompt(
    sourceLanguage?: string,
    targetLanguage: string = 'Tiếng Việt',
  ): string {
    const langInstruction = sourceLanguage
      ? `Dịch từ ${sourceLanguage} sang ${targetLanguage}.`
      : `Dịch sang ${targetLanguage}.`;

    return `Bạn là dịch giả. ${langInstruction}
INPUT: JSON object với key là index, value là text cần dịch.
OUTPUT: JSON object với CÙNG key, value là bản dịch.

QUY TẮC:
- CHỈ trả về JSON thuần, không giải thích.
- GIỮ NGUYÊN tất cả keys.
- Không dịch từ chuyên ngành, URL, code.

VÍ DỤ:
Input: {"0": "Hello", "1": "Get started"}
Output: {"0": "Xin chào", "1": "Bắt đầu"}`;
  }

  /**
   * Parse JSON response, xử lý trường hợp model trả về không đúng format
   */
  private parseJsonResponse(text: string): Record<string, string> {
    try {
      // Tìm JSON trong response (có thể có text thừa)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      this.logger.warn(`Không thể parse JSON response: ${text}`);
      return {};
    }
  }
}
