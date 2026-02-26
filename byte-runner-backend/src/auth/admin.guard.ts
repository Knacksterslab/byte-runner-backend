import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request.session) throw new UnauthorizedException('Not authenticated');

    // Resolve user here and pre-populate request.user so the global interceptor skips a second DB call.
    const user = await this.usersService.getOrCreateUser(request.session.getUserId());
    request.user = user;

    const adminEmails: string[] = this.configService.get<string[]>('admin.emails') ?? [];
    if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
      this.logger.warn(`Admin access denied for ${user.email ?? 'unknown'}`);
      throw new UnauthorizedException('Admin access required');
    }

    return true;
  }
}
