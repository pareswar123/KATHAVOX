import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { PaymentType } from '../../database/entities';

/** The client only says what it wants to buy. The price is always read from the database. */
export class CreateOrderDto {
  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  purchaseType: PaymentType;

  @ApiPropertyOptional({ description: 'Required for STORY_PURCHASE' })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Required for BOOK_PURCHASE' })
  @IsOptional()
  @IsUUID()
  bookId?: string;

  @ApiPropertyOptional({ description: 'Required for SUBSCRIPTION' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  checkoutEmail: string;

  @ApiProperty()
  @IsString()
  @Length(2, 150)
  fullName: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  razorpay_order_id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  razorpay_payment_id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  razorpay_signature: string;
}
