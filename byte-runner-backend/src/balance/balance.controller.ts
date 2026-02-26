import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { AdminGuard } from '../auth/admin.guard';
import { BalanceService, BalanceTransaction } from './balance.service';
import { WithdrawalService } from './withdrawal.service';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { SubmitWithdrawalDto } from './dto/submit-withdrawal.dto';

function mapTransaction(t: BalanceTransaction) {
  return {
    id: t.id,
    amountCents: t.amount_cents,
    type: t.type,
    description: t.description,
    createdAt: t.created_at,
  };
}

@Controller('balance')
export class BalanceController {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly withdrawalService: WithdrawalService,
  ) {}

  @UseGuards(SupertokensGuard)
  @Get('me')
  async getMyBalance(@CurrentUserId() userId: string) {
    const info = await this.balanceService.getUserBalance(userId);
    return {
      balanceCents: info.balance_cents,
      pendingWithdrawalsCents: info.pending_withdrawals_cents,
      totalEarnedCents: info.total_earned_cents,
      recentTransactions: info.transactions.map(mapTransaction),
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('transactions')
  async getTransactions(
    @CurrentUserId() userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const transactions = await this.balanceService.getTransactions(
      userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return { transactions: transactions.map(mapTransaction) };
  }

  @UseGuards(SupertokensGuard)
  @Post('withdraw')
  async submitWithdrawal(@CurrentUserId() userId: string, @Body() body: SubmitWithdrawalDto) {
    const withdrawal = await this.withdrawalService.submitWithdrawal(
      userId,
      body.amountCents,
      body.paymentMethod,
      body.contactInfo,
    );
    return {
      id: withdrawal.id,
      amountCents: withdrawal.amount_cents,
      paymentMethod: withdrawal.payment_method,
      status: withdrawal.status,
      submittedAt: withdrawal.submitted_at,
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('withdrawals')
  async getMyWithdrawals(@CurrentUserId() userId: string) {
    const withdrawals = await this.withdrawalService.getWithdrawals(userId);
    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amountCents: w.amount_cents,
        paymentMethod: w.payment_method,
        status: w.status,
        submittedAt: w.submitted_at,
        reviewedAt: w.reviewed_at,
        notes: w.notes,
      })),
    };
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Get('admin/withdrawals')
  getAllWithdrawals(@Query('status') status?: string) {
    return this.withdrawalService.getAllWithdrawals(status);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/process-usdt')
  processAllUsdt() {
    return this.withdrawalService.processAllApprovedUsdtWithdrawals();
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/process-usdt/:id')
  processUsdt(@Req() req: any) {
    const id = req.params.id;
    if (!id) throw new BadRequestException('Missing withdrawal id');
    return this.withdrawalService.processUsdtWithdrawal(id);
  }
}
