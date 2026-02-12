import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.session;

    if (!session) {
      console.log('❌ Admin check failed: No session');
      throw new UnauthorizedException('Not authenticated');
    }

    const supertokensId = session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    const adminEmails = this.configService.get<string[]>('admin.emails') || [];
    
    console.log('🔍 Admin check:', {
      userEmail: user.email,
      userEmailLower: user.email?.toLowerCase(),
      adminEmails,
      adminEmailsLower: adminEmails.map(e => e.toLowerCase()),
      match: user.email && adminEmails.includes(user.email.toLowerCase())
    });
    
    if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
      console.log('❌ Admin check failed: Email not in admin list');
      throw new UnauthorizedException('Admin access required');
    }

    console.log('✅ Admin check passed!');
    return true;
  }
}
