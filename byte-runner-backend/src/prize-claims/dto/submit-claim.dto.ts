import { IsObject, IsString, IsEmail, IsOptional } from 'class-validator';

export class SubmitClaimDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  payment_method?: string; // 'paypal', 'venmo', 'bank_transfer', etc.

  @IsString()
  @IsOptional()
  payment_details?: string; // PayPal email, Venmo handle, etc.

  @IsString()
  @IsOptional()
  usdt_wallet?: string;

  @IsString()
  @IsOptional()
  usdt_network?: string;

  @IsObject()
  @IsOptional()
  shipping_address?: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };

  @IsString()
  @IsOptional()
  notes?: string;
}
