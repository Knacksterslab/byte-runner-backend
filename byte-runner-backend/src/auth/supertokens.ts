import SuperTokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { ConfigService } from '@nestjs/config';

export function initSupertokens(configService: ConfigService) {
  const apiDomain = configService.get<string>('app.apiDomain');
  const websiteDomain = configService.get<string>('app.websiteDomain');
  const appName = configService.get<string>('app.appName');
  const connectionUri = configService.get<string>('supertokens.connectionUri');
  const apiKey = configService.get<string>('supertokens.apiKey');
  const apiBasePath = configService.get<string>('supertokens.apiBasePath');
  const websiteBasePath = configService.get<string>('supertokens.websiteBasePath');

  if (!apiDomain || !websiteDomain || !appName || !connectionUri) {
    throw new Error('Supertokens configuration is missing.');
  }

  console.log('🔐 SuperTokens Config:', {
    apiDomain,
    websiteDomain,
    apiBasePath,
    websiteBasePath,
    connectionUri: connectionUri.substring(0, 40) + '...'
  });

  SuperTokens.init({
    framework: 'express',
    supertokens: {
      connectionURI: connectionUri,
      apiKey: apiKey || undefined,
    },
    appInfo: {
      appName,
      apiDomain,
      websiteDomain,
      apiBasePath,
      websiteBasePath,
    },
    recipeList: [
      EmailPassword.init(),
      Session.init({
        cookieSameSite: 'lax',
        cookieSecure: false,
        getTokenTransferMethod: () => 'cookie',
        override: {
          functions: (originalImplementation) => {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {
                console.log('🔐 Creating new session for user:', input.userId);
                return originalImplementation.createNewSession(input);
              },
            };
          },
        },
      }),
    ],
  });
}
