import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TronWebLib = require('tronweb');
const TronWeb = TronWebLib.TronWeb || TronWebLib;

interface TronConfig {
  network: 'mainnet' | 'shasta';
  apiKey?: string;
  hotWalletAddress: string;
  hotWalletPrivateKey: string;
  usdtContractAddress: string;
  maxSinglePayoutUsdt: number;
  minBalanceUsdt: number;
}

export interface TransactionResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export interface BalanceInfo {
  trx: number;
  usdt: number;
}

@Injectable()
export class TronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TronService.name);
  private tronWeb: any;
  private config: TronConfig;
  private destroyed = false;
  private pendingSleepHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeConfig();
    this.initializeTronWeb();
  }

  async onModuleInit() {
    await this.verifyConnection();
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.pendingSleepHandle) {
      clearTimeout(this.pendingSleepHandle);
      this.pendingSleepHandle = null;
    }
  }

  private initializeConfig() {
    const network = this.configService.get<string>('TRON_NETWORK', 'shasta');
    if (network !== 'mainnet' && network !== 'shasta') {
      throw new Error(`Invalid TRON_NETWORK: ${network}. Must be 'mainnet' or 'shasta'`);
    }

    this.config = {
      network: network as 'mainnet' | 'shasta',
      apiKey: this.configService.get<string>('TRONGRID_API_KEY'),
      hotWalletAddress: this.configService.get<string>('TRON_HOT_WALLET_ADDRESS', ''),
      hotWalletPrivateKey: this.configService.get<string>('TRON_HOT_WALLET_PRIVATE_KEY', ''),
      usdtContractAddress: this.configService.get<string>(
        'USDT_CONTRACT_ADDRESS',
        network === 'mainnet'
          ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
          : 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
      ),
      maxSinglePayoutUsdt: parseFloat(this.configService.get<string>('MAX_SINGLE_PAYOUT_USDT', '10')),
      minBalanceUsdt: parseFloat(this.configService.get<string>('HOT_WALLET_MIN_BALANCE_USDT', '20')),
    };
  }

  private initializeTronWeb() {
    const fullNodeUrl =
      this.config.network === 'mainnet'
        ? 'https://api.trongrid.io'
        : 'https://api.shasta.trongrid.io';

    const headers = this.config.apiKey ? { 'TRON-PRO-API-KEY': this.config.apiKey } : {};

    this.tronWeb = new TronWeb({
      fullHost: fullNodeUrl,
      headers,
      privateKey: this.config.hotWalletPrivateKey,
    });

    this.logger.log(`TronWeb initialized for ${this.config.network}`);
  }

  private async verifyConnection() {
    try {
      const connected = await this.tronWeb.isConnected();
      if (!connected) throw new Error('TronWeb connection failed');

      const balance = await this.getBalance();
      this.logger.log(`TronWeb connected. Balance: ${balance.trx} TRX, ${balance.usdt} USDT`);

      if (balance.usdt < this.config.minBalanceUsdt) {
        this.logger.warn(`Hot wallet USDT (${balance.usdt}) below minimum (${this.config.minBalanceUsdt})`);
      }
      if (balance.trx < 50) {
        this.logger.warn(`Hot wallet TRX (${balance.trx}) is low — needed for gas`);
      }
    } catch (error) {
      this.logger.error('TronWeb connection verification failed:', error);
      throw error;
    }
  }

  async getBalance(): Promise<BalanceInfo> {
    try {
      const trxBalance = await this.tronWeb.trx.getBalance(this.config.hotWalletAddress);
      const trx = this.tronWeb.fromSun(trxBalance);

      const contract = await this.tronWeb.contract().at(this.config.usdtContractAddress);
      const usdtBalance = await contract.balanceOf(this.config.hotWalletAddress).call();
      const usdt = parseFloat(this.tronWeb.fromSun(usdtBalance.toString()));

      return { trx, usdt };
    } catch (error) {
      this.logger.error('Failed to get balance:', error);
      throw error;
    }
  }

  async sendUsdt(toAddress: string, amountUsdt: number): Promise<TransactionResult> {
    try {
      if (amountUsdt <= 0) return { success: false, error: 'Amount must be greater than 0' };

      if (amountUsdt > this.config.maxSinglePayoutUsdt) {
        return {
          success: false,
          error: `Amount ${amountUsdt} exceeds max single payout ${this.config.maxSinglePayoutUsdt} USDT`,
        };
      }

      if (!this.tronWeb.isAddress(toAddress)) {
        return { success: false, error: `Invalid Tron address: ${toAddress}` };
      }

      const balance = await this.getBalance();
      if (balance.usdt < amountUsdt) {
        return { success: false, error: `Insufficient USDT. Have: ${balance.usdt}, need: ${amountUsdt}` };
      }
      if (balance.trx < 20) {
        return { success: false, error: `Insufficient TRX for gas. Balance: ${balance.trx} TRX` };
      }

      const contract = await this.tronWeb.contract().at(this.config.usdtContractAddress);
      const amountSun = this.tronWeb.toSun(amountUsdt.toString());
      const tx = await contract.transfer(toAddress, amountSun).send({ feeLimit: 100_000_000 });

      const confirmed = await this.waitForConfirmation(tx, 60_000);
      if (confirmed) {
        this.logger.log(`USDT sent. TxID: ${tx}`);
        return { success: true, txId: tx };
      }

      this.logger.warn(`Transaction unconfirmed after timeout: ${tx}`);
      return { success: false, error: 'Transaction timeout', txId: tx };
    } catch (error) {
      this.logger.error('Failed to send USDT:', error);
      return { success: false, error: error.message ?? 'Unknown error' };
    }
  }

  private async waitForConfirmation(txId: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (!this.destroyed && Date.now() < deadline) {
      try {
        const txInfo = await this.tronWeb.trx.getTransactionInfo(txId);
        if (txInfo?.id) {
          if (txInfo.receipt?.result === 'SUCCESS') return true;
          if (txInfo.receipt?.result === 'FAILED') {
            this.logger.error(`Transaction failed on-chain: ${txId}`);
            return false;
          }
        }
      } catch {
        // not yet on chain — continue polling
      }

      await this.sleep(3000);
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pendingSleepHandle = setTimeout(() => {
        this.pendingSleepHandle = null;
        resolve();
      }, ms);
    });
  }

  async getTransaction(txId: string) {
    try {
      const [tx, txInfo] = await Promise.all([
        this.tronWeb.trx.getTransaction(txId),
        this.tronWeb.trx.getTransactionInfo(txId),
      ]);
      return { tx, txInfo };
    } catch (error) {
      this.logger.error(`Failed to get transaction ${txId}:`, error);
      throw error;
    }
  }

  getExplorerUrl(txId: string): string {
    const base = this.config.network === 'mainnet' ? 'https://tronscan.org' : 'https://shasta.tronscan.org';
    return `${base}/#/transaction/${txId}`;
  }
}
