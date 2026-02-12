import { IsObject, IsString, IsEmail, IsOptional } from 'class-validator';

export class SubmitClaimDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string; // 'paypal', 'venmo', 'bank_transfer', etc.

  @IsString()
  @IsOptional()
  paymentDetails?: string; // PayPal email, Venmo handle, etc.

  @IsObject()
  @IsOptional()
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @IsString()
  @IsOptional()
  notes?: string;
}
