import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import SuperTokens from 'supertokens-node';
import { middleware, errorHandler } from 'supertokens-node/framework/express';
import { initSupertokens } from './auth/supertokens';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const configService = app.get(ConfigService);

  initSupertokens(configService);

  const apiDomain = configService.get<string>('app.apiDomain');
  const websiteDomain = configService.get<string>('app.websiteDomain');
  
  const fs = require('fs');
  const configLog = JSON.stringify({runId:'backend-debug',location:'main.ts:bootstrap',message:'SuperTokens initialized',data:{apiDomain,websiteDomain,apiBasePath:configService.get('supertokens.apiBasePath'),connectionUri:configService.get('supertokens.connectionUri')?.substring(0,30)+'...'},timestamp:Date.now()}) + '\n';
  fs.appendFileSync('c:\\Users\\futur\\Projects\\chap\\.cursor\\debug.log', configLog);

  // Manual CORS middleware that runs FIRST
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [websiteDomain, 'http://localhost:3000'];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
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

  // SuperTokens middleware
  app.use((req, res, next) => {
    if (req.url?.startsWith('/auth')) {
      const fs = require('fs');
      const logEntry = JSON.stringify({runId:'backend-debug',location:'main.ts:before-supertokens',message:'Auth request received',data:{url:req.url,method:req.method,headers:{rid:req.headers.rid,fdiVersion:req.headers['fdi-version'],stAuthMode:req.headers['st-auth-mode']},origin:req.headers.origin},timestamp:Date.now()}) + '\n';
      fs.appendFileSync('c:\\Users\\futur\\Projects\\chap\\.cursor\\debug.log', logEntry);
      
      const oldSend = res.send;
      res.send = function(data) {
        const logEntry2 = JSON.stringify({runId:'backend-debug',location:'main.ts:after-supertokens',message:'Auth response sent',data:{url:req.url,statusCode:res.statusCode,responsePreview:typeof data === 'string' ? data.substring(0,200) : JSON.stringify(data).substring(0,200)},timestamp:Date.now()}) + '\n';
        fs.appendFileSync('c:\\Users\\futur\\Projects\\chap\\.cursor\\debug.log', logEntry2);
        return oldSend.apply(res, arguments);
      };
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
