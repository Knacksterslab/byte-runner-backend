import { IsInt, IsNotEmpty, IsObject, IsString, Min } from 'class-validator';

export class SubmitWithdrawalDto {
  @IsInt()
  @Min(1000, { message: 'Minimum withdrawal is $10.00' })
  amountCents: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsObject()
  @IsNotEmpty()
  contactInfo: any;
}
