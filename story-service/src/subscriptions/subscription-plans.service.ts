import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../database/entities';
import { t } from '../i18n/i18n';
import { PlanInputDto, PlanUpdateDto } from './dto/plan.dto';

/** Admin management of subscription plans. Public readers only ever see active plans. */
@Injectable()
export class SubscriptionPlansService {
  constructor(@InjectRepository(SubscriptionPlan) private readonly plans: Repository<SubscriptionPlan>) {}

  list(): Promise<SubscriptionPlan[]> {
    return this.plans.find({ order: { pricePaise: 'ASC' } });
  }

  create(dto: PlanInputDto): Promise<SubscriptionPlan> {
    return this.plans.save(
      this.plans.create({
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        pricePaise: dto.pricePaise,
        durationDays: dto.durationDays,
        isActive: true,
      }),
    );
  }

  async update(id: string, dto: PlanUpdateDto): Promise<SubscriptionPlan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(t('subscriptions.planNotFound'));
    if (dto.name !== undefined) plan.name = dto.name.trim();
    if (dto.description !== undefined) plan.description = dto.description.trim();
    if (dto.pricePaise !== undefined) plan.pricePaise = dto.pricePaise;
    if (dto.durationDays !== undefined) plan.durationDays = dto.durationDays;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;
    return this.plans.save(plan);
  }
}
