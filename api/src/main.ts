import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS cho phép tất cả domains
  app.enableCors({
    origin: true, // Cho phép tất cả origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable validation pipe để validate DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Loại bỏ các property không có trong DTO
      forbidNonWhitelisted: true, // Throw error nếu có property không hợp lệ
      transform: true, // Tự động transform type
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = 2053;
  await app.listen(port);
  console.log(`🚀 API server đang chạy tại http://localhost:${port}`);
}
bootstrap();
