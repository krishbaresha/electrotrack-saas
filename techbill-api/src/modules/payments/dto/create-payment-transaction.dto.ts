import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreatePaymentTransactionDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
