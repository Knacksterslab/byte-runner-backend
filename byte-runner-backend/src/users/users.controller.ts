import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRecord } from './users.service';
import { SetUsernameDto } from './dto/set-username.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('clear-session')
  clearSession(@Res() res: Response) {
    const isProduction = this.configService.get<string>('app.nodeEnv') === 'production';
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      secure: isProduction,
    };
    res.clearCookie('sAccessToken', cookieOptions);
    res.clearCookie('sRefreshToken', { ...cookieOptions, path: '/auth/session/refresh' });
    res.clearCookie('sIdRefreshToken', cookieOptions);
    res.status(200).json({ status: 'OK', message: 'Session cleared' });
  }

  @UseGuards(SupertokensGuard)
  @Get('me')
  getMe(@CurrentUser() user: UserRecord) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      continueTokens: user.continue_tokens ?? 0,
      featuredBadge: user.featured_badge ?? null,
      createdAt: user.created_at,
    };
  }

  @UseGuards(SupertokensGuard)
  @Post('username')
  async setUsername(@CurrentUser() user: UserRecord, @Body() body: SetUsernameDto) {
    const updated = await this.usersService.setUsername(user.id, body.username);
    return { id: updated.id, username: updated.username, createdAt: updated.created_at };
  }
}
