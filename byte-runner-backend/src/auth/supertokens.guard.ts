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
          console.error(
            JSON.stringify({
              runId: 'contest-submit-debug',
              hypothesisId: 'H4',
              location: 'supertokens.guard.ts:verifySession:error',
              message: 'verifySession rejected request',
              data: {
                url: req.url,
                method: req.method,
                origin: req.headers?.origin || null,
                hasCookieHeader: Boolean(req.headers?.cookie),
                errType: err?.type || null,
                errMessage: err?.message || String(err),
              },
              timestamp: Date.now(),
            }),
          );
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/8044fb5f-bff6-484b-95e6-3e4a2d42e250', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              runId: 'contest-submit-debug',
              hypothesisId: 'H4',
              location: 'supertokens.guard.ts:verifySession:error',
              message: 'verifySession rejected request',
              data: {
                url: req.url,
                method: req.method,
                origin: req.headers?.origin || null,
                hasCookieHeader: Boolean(req.headers?.cookie),
                errType: err?.type || null,
                errMessage: err?.message || String(err),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          reject(err);
        } else {
          console.log(
            JSON.stringify({
              runId: 'contest-submit-debug',
              hypothesisId: 'H4',
              location: 'supertokens.guard.ts:verifySession:ok',
              message: 'verifySession accepted request',
              data: {
                url: req.url,
                method: req.method,
                origin: req.headers?.origin || null,
                hasCookieHeader: Boolean(req.headers?.cookie),
              },
              timestamp: Date.now(),
            }),
          );
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/8044fb5f-bff6-484b-95e6-3e4a2d42e250', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              runId: 'contest-submit-debug',
              hypothesisId: 'H4',
              location: 'supertokens.guard.ts:verifySession:ok',
              message: 'verifySession accepted request',
              data: {
                url: req.url,
                method: req.method,
                origin: req.headers?.origin || null,
                hasCookieHeader: Boolean(req.headers?.cookie),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          resolve(true);
        }
      });
    });
  }
}
