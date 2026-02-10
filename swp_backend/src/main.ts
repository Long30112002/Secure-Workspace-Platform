import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { MyLoggerService } from './my-logger/my-logger.service';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';
import { SocketIOAdapter } from './socket-io.adapter';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule, {
    logger: ['error', 'warn', 'debug'],
    // cors: {
    //   origin: 'http://localhost:5173',
    //   credentials: true,
    // },
  });

  // WebSocket adapter với CORS config
  app.useWebSocketAdapter(new SocketIOAdapter(app));

  app.use((req, res, next) => {
    console.log('Request Origin:', req.headers.origin);
    console.log('Request Method:', req.method);
    console.log('Request Headers:', req.headers);
    next();
  });

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-CSRF-Token',
      'Cookie',
      'Set-Cookie',
      'Cache-Control',
      'Pragma',
      'Expires'
    ],
    exposedHeaders: [
      'Authorization',
      'Set-Cookie',
      'X-Total-Count',
      'X-Page',
      'X-Per-Page',
      'Content-Disposition',
      'Content-Length',
    ],
  });

  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  //Thêm body parser middleware
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));

  app.use('/uploads', express.static(join(process.cwd(), 'public', 'uploads'), {
    fallthrough: false,
  }));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // Loại bỏ field không có trong DTO
      forbidNonWhitelisted: true,  // Báo lỗi nếu có field thừa
      transform: true,             // Tự động transform types
      disableErrorMessages: false, // Hiển thị error messages'
      transformOptions: {
        enableImplicitConversion: true, // Cho phép implicit conversion
      },
    })
  )

  const logger = app.get(MyLoggerService);
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Server running on http://localhost:3000`);
  console.log(`🌐 CORS enabled for: http://localhost:5173`);
  console.log(`📝 Global prefix: /api`);
  console.log(`🔌 WebSocket enabled on: ws://localhost:3000/workspace`);

}
bootstrap();
