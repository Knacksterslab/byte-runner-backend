import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UsersService } from '../../users/users.service';
import { getSession } from 'supertokens-node/recipe/session';

/**
 * Global interceptor that resolves the authenticated user once per request
 * and attaches it to request.user. Guards (e.g. AdminGuard) may pre-populate
 * request.user to avoid a second DB call on the same request.
 */
@Injectable()
export class ResolveUserInterceptor implements NestInterceptor {
  constructor(private readonly usersService: UsersService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    if (!request.user) {
      // Unguarded routes never get req.session from the middleware — resolve
      // it ourselves so optional-auth endpoints personalize correctly.
      if (!request.session) {
        try {
          request.session = await getSession(ctx.getRequest(), ctx.getResponse(), {
            sessionRequired: false,
          });
        } catch {
          // no valid session — leave anonymous
        }
      }
      if (request.session) {
        request.user = await this.usersService.getOrCreateUser(request.session.getUserId());
      }
    }
    return next.handle();
  }
}
