import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/auth.decorators';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Public()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Razorpay order. The amount is calculated on the server.' })
  createOrder(@Body() dto: CreateOrderDto) {
    return this.payments.createOrder(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a completed checkout: signature, capture and amount are checked' })
  verify(@Body() dto: VerifyPaymentDto) {
    return this.payments.verify(dto);
  }

  @Post('recover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a paid order from Razorpay when the browser never reported it' })
  recover(@Body() body: { orderId: string }) {
    return this.payments.recover(String(body?.orderId ?? ''));
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Razorpay webhook. Requires X-Razorpay-Signature over the raw body.' })
  webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: { event: string; payload: any },
  ) {
    return this.payments.webhook(req.rawBody ?? Buffer.from(JSON.stringify(body)), signature, body);
  }
}
