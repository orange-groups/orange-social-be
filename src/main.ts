import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { createHttpRequestLogger } from './common/middleware/http-request-logger';
import { configureHttpApi } from './common/configure-http-api';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureHttpApi(app);
  app.use(createHttpRequestLogger());
  app.use(cookieParser());

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  app.enableCors({
    origin: new URL(frontendUrl).origin,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
