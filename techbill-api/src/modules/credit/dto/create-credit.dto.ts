import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';
import { CreditType } from '@prisma/client';

export class CreateCreditDto {
  @IsEnum(CreditType)
  type: CreditType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  personName?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;
}
