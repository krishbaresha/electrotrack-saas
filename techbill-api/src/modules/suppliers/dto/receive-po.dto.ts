import { IsEnum, IsArray, IsOptional, ValidateNested, IsUUID, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivePoItemDto {
  @IsUUID()
  productId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serialNumbers?: string[];
}

export class ReceivePoDto {
  @IsEnum(['auto', 'manual'])
  snGenerationMethod: 'auto' | 'manual';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePoItemDto)
  @IsOptional()
  items?: ReceivePoItemDto[];
}
