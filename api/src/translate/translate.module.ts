import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TranslateController } from './translate.controller';
import { TranslateService } from './translate.service';

/**
 * Module quản lý chức năng dịch thuật
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [TranslateController],
  providers: [TranslateService],
  exports: [TranslateService],
})
export class TranslateModule {}
