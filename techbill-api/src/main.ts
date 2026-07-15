import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helmet = require('helmet');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'http://localhost:5173',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }
      const isAllowed =
        allowedOrigins.some((allowed) => {
          if (allowed === origin) return true;
          try {
            const allowedUrl = new URL(allowed);
            const originUrl = new URL(origin);
            const allowedHost = allowedUrl.hostname;
            const originHost = originUrl.hostname;
            return (
              originHost === allowedHost ||
              originHost.endsWith('.' + allowedHost)
            );
          } catch {
            return false;
          }
        }) ||
        origin.endsWith('.techbill.app') ||
        origin === 'https://techbill.app';
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
  console.log('API is running...');
}
void bootstrap();
