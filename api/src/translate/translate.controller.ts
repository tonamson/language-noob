import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TranslateService } from './translate.service';
import { TranslateRequestDto } from './dto/translate-request.dto';
import { TranslateReverseRequestDto } from './dto/translate-reverse-request.dto';
import { TranslateResponseDto } from './dto/translate-response.dto';

/**
 * Controller xử lý các request liên quan đến dịch thuật
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
}
