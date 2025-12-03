import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TranslateController } from './translate.controller';
import { TranslateService } from './translate.service';
import { ImageOcrService } from './services/image-ocr.service';

/**
 * Module quản lý chức năng dịch thuật
 * Bao gồm:
 * - Dịch văn bản với Qwen3
 * - Dịch ảnh với OCR (Tesseract.js) + Vision AI (LLaMA 3.2 Vision) + Translation (Qwen3)
 */
@Module({
  imports: [
    HttpModule.register({
      // Không giới hạn timeout - để Ollama xử lý thoải mái
      maxRedirects: 5,
    }),
  ],
  controllers: [TranslateController],
  providers: [TranslateService, ImageOcrService],
  exports: [TranslateService, ImageOcrService],
})
export class TranslateModule {}
