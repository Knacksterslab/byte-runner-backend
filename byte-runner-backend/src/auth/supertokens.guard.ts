import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';

@Injectable()
export class SupertokensGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    return new Promise((resolve, reject) => {
      verifySession()(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }
}
