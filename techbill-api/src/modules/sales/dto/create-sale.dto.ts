import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  ArrayMinSize,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serials: string[];

  @IsOptional()
  customPrices?: Record<string, number>;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  additionalCharges?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discountAmount?: number;

  @IsString()
  @IsOptional()
  otpToken?: string;

  @IsOptional()
  isOnline?: boolean;

  @IsString()
  @IsOptional()
  customerCity?: string;

  @IsString()
  @IsOptional()
  trackingId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  deliveryCharge?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  advanceAmount?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  codAmount?: number;
}
