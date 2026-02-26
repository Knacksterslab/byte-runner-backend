import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UsersService } from '../../users/users.service';

/**
 * Global interceptor that resolves the authenticated user once per request
 * and attaches it to request.user. Guards (e.g. AdminGuard) may pre-populate
 * request.user to avoid a second DB call on the same request.
 */
@Injectable()
export class ResolveUserInterceptor implements NestInterceptor {
  constructor(private readonly usersService: UsersService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (!request.user && request.session) {
      request.user = await this.usersService.getOrCreateUser(request.session.getUserId());
    }
    return next.handle();
  }
}
