import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TranslateService } from './translate.service';
import { TranslateRequestDto } from './dto/translate-request.dto';
import { TranslateResponseDto } from './dto/translate-response.dto';
import {
  ImageTranslateRequestDto,
  ImageTranslateResponseDto,
} from './dto/image-translate.dto';

/**
 * Controller xử lý các request liên quan đến dịch thuật
 * Hỗ trợ dịch text và dịch ảnh với OCR + AI Vision
 */
@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  /**
   * API dịch văn bản
   * @param translateRequestDto Dữ liệu request chứa prompt cần dịch
   * @returns Kết quả dịch thuật
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async translate(
    @Body() translateRequestDto: TranslateRequestDto,
  ): Promise<TranslateResponseDto> {
    return this.translateService.translate(translateRequestDto);
  }

  /**
   * API dịch ảnh với OCR + Vision AI
   *
   * Flow xử lý:
   * 1. Tesseract.js detect text boxes trong ảnh
   * 2. Crop từng box và gửi vào llama3.2-vision để đọc text
   * 3. Dịch text với qwen3:8b
   * 4. Trả về kết quả với bounding box coordinates
   *
   * @param file Ảnh upload qua form-data (field name: "image")
   * @param body Tùy chọn ngôn ngữ nguồn/đích
   * @returns Danh sách blocks với originalText, translatedText và box
   */
  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  async translateImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Giới hạn file 10MB
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // Chỉ chấp nhận ảnh
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|gif|webp|bmp)$/,
          }),
        ],
        fileIsRequired: true,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    file: Express.Multer.File,
    @Body() body: ImageTranslateRequestDto,
  ): Promise<ImageTranslateResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Vui lòng upload ảnh với field name là "image"',
      );
    }

    const { sourceLanguage, targetLanguage = 'Tiếng Việt' } = body;

    return this.translateService.translateImage(
      file.buffer,
      sourceLanguage,
      targetLanguage,
    );
  }
}
