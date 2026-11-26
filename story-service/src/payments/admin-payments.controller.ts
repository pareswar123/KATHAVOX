import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/auth.decorators';
import { UserRole } from '../database/entities';
import { AdminPaymentsQueryDto } from './dto/admin-payments.dto';
import { PaymentsService } from './payments.service';

/** Admin view of recorded payments. Defaults to today when no dates are given. */
@ApiTags('Admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments')
  @ApiOperation({ summary: 'Payments by day range (default today), status and type' })
  list(@Query() query: AdminPaymentsQueryDto) {
    return this.payments.listForAdmin(query);
  }

  @Get('payments/export')
  @ApiOperation({ summary: 'Excel file of every payment in the same filter (all rows, not one page)' })
  async export(@Query() query: AdminPaymentsQueryDto, @Res() res: Response): Promise<void> {
    const file = await this.payments.exportForAdmin(query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.end(file.buffer);
  }
}
