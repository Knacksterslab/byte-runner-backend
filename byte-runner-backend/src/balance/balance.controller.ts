import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { BalanceService } from './balance.service';
import { SubmitWithdrawalDto } from './dto/submit-withdrawal.dto';

@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @UseGuards(SupertokensGuard)
  @Get('me')
  async getMyBalance(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    // We need to get the user_id from supertokens_id
    const { data: user } = await this.balanceService['client']
      .from('users')
      .select('id')
      .eq('supertokens_id', supertokensId)
      .single();

    if (!user) {
      throw new Error('User not found');
    }

    const balanceInfo = await this.balanceService.getUserBalance(user.id);
    return {
      balanceCents: balanceInfo.balance_cents,
      pendingWithdrawalsCents: balanceInfo.pending_withdrawals_cents,
      totalEarnedCents: balanceInfo.total_earned_cents,
      recentTransactions: balanceInfo.transactions.map(t => ({
        id: t.id,
        amountCents: t.amount_cents,
        type: t.type,
        description: t.description,
        createdAt: t.created_at
      }))
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const supertokensId = req.session.getUserId();
    const { data: user } = await this.balanceService['client']
      .from('users')
      .select('id')
      .eq('supertokens_id', supertokensId)
      .single();

    if (!user) {
      throw new Error('User not found');
    }

    const transactions = await this.balanceService.getTransactions(
      user.id,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0
    );

    return {
      transactions: transactions.map(t => ({
        id: t.id,
        amountCents: t.amount_cents,
        type: t.type,
        description: t.description,
        createdAt: t.created_at
      }))
    };
  }

  @UseGuards(SupertokensGuard)
  @Post('withdraw')
  async submitWithdrawal(@Req() req: any, @Body() body: SubmitWithdrawalDto) {
    const supertokensId = req.session.getUserId();
    const { data: user } = await this.balanceService['client']
      .from('users')
      .select('id')
      .eq('supertokens_id', supertokensId)
      .single();

    if (!user) {
      throw new Error('User not found');
    }

    const withdrawal = await this.balanceService.submitWithdrawal(
      user.id,
      body.amountCents,
      body.paymentMethod,
      body.contactInfo
    );

    return {
      id: withdrawal.id,
      amountCents: withdrawal.amount_cents,
      paymentMethod: withdrawal.payment_method,
      status: withdrawal.status,
      submittedAt: withdrawal.submitted_at
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('withdrawals')
  async getMyWithdrawals(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    const { data: user } = await this.balanceService['client']
      .from('users')
      .select('id')
      .eq('supertokens_id', supertokensId)
      .single();

    if (!user) {
      throw new Error('User not found');
    }

    const withdrawals = await this.balanceService.getWithdrawals(user.id);

    return {
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        amountCents: w.amount_cents,
        paymentMethod: w.payment_method,
        status: w.status,
        submittedAt: w.submitted_at,
        reviewedAt: w.reviewed_at,
        notes: w.notes
      }))
    };
  }
}
