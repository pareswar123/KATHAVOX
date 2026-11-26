import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/auth.decorators';
import { UserRole } from '../database/entities';
import { PlanInputDto, PlanUpdateDto } from './dto/plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@ApiTags('Admin subscriptions')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/subscription-plans')
export class AdminPlansController {
  constructor(private readonly plans: SubscriptionPlansService) {}

  @Get()
  list() {
    return this.plans.list();
  }

  @Post()
  create(@Body() dto: PlanInputDto) {
    return this.plans.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlanUpdateDto) {
    return this.plans.update(id, dto);
  }
}
