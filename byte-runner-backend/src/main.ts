import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import SuperTokens from 'supertokens-node';
import { middleware, errorHandler } from 'supertokens-node/framework/express';
import { initSupertokens } from './auth/supertokens';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  const configService = app.get(ConfigService);

  initSupertokens(configService);

  const websiteDomain = configService.get<string>('app.websiteDomain');

  const normalizeOrigin = (value?: string): string | null => {
    if (!value) return null;
    try {
      return new URL(value).origin;
    } catch {
      return value.replace(/\/+$/, '');
    }
  };

  const configuredOrigins = (websiteDomain || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));

  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...configuredOrigins,
  ]);

  for (const origin of [...allowedOrigins]) {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname.startsWith('www.')) {
        parsed.hostname = parsed.hostname.replace(/^www\./, '');
        allowedOrigins.add(parsed.origin);
      } else {
        parsed.hostname = `www.${parsed.hostname}`;
        allowedOrigins.add(parsed.origin);
      }
    } catch {
      // ignore malformed origins
    }
  }

  const isTrustedPublicOrigin = (origin: string): boolean => {
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      return hostname === 'byterunner.co' || hostname.endsWith('.byterunner.co');
    } catch {
      return false;
    }
  };

  app.use((req, res, next) => {
    const requestOrigin = normalizeOrigin(req.headers.origin);
    const isAllowed = Boolean(
      requestOrigin && (allowedOrigins.has(requestOrigin) || isTrustedPublicOrigin(requestOrigin)),
    );

    if (isAllowed && requestOrigin) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      res.header('Access-Control-Allow-Headers', ['content-type', 'authorization', ...SuperTokens.getAllCORSHeaders()].join(', '));
      res.header('Access-Control-Expose-Headers', ['content-type', ...SuperTokens.getAllCORSHeaders()].join(', '));
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  app.use(middleware());
  app.use(errorHandler());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
}
bootstrap();
