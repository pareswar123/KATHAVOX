import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { GlobalExceptionFilter, ResponseEnvelopeInterceptor } from './common/api-response';

async function bootstrap(): Promise<void> {
  // rawBody is needed later to verify Razorpay webhook signatures.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const cfg = app.get(AppConfig);

  const uploadDir = resolve(cfg.upload.directory);
  mkdirSync(uploadDir, { recursive: true });

  app.setGlobalPrefix(cfg.apiPrefix);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: cfg.frontendOrigin, credentials: true });
  app.useStaticAssets(uploadDir, { prefix: cfg.upload.urlPath });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${cfg.appName} API`)
    .setVersion(cfg.apiVersion)
    .addBearerAuth()
    .build();
  SwaggerModule.setup(cfg.swaggerPath, app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(cfg.port);
  console.log(
    `${cfg.appName} API: http://localhost:${cfg.port}/${cfg.apiPrefix} | Swagger: http://localhost:${cfg.port}/${cfg.swaggerPath}`,
  );
}

void bootstrap();
