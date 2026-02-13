import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { UsersService } from './users.service';
import { SetUsernameDto } from './dto/set-username.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('clear-session')
  async clearSession(@Res() res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    // Forcefully clear all SuperTokens cookies
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
  async getMe(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      continueTokens: user.continue_tokens || 0,
      featuredBadge: user.featured_badge || null,
      createdAt: user.created_at,
    };
  }

  @UseGuards(SupertokensGuard)
  @Post('username')
  async setUsername(@Req() req: any, @Body() body: SetUsernameDto) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.setUsername(supertokensId, body.username);
    return {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
    };
  }
}
