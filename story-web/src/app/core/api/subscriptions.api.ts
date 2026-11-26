import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../config/endpoints';
import { ApiEnvelope } from '../http/api.types';
import { SubscriptionPlan } from '../models/subscription.model';

export interface PlanInput {
  name: string;
  description?: string;
  pricePaise?: number;
  durationDays?: number;
  isActive?: boolean;
}

/** Plan reads for visitors and plan management for admins. */
@Injectable({ providedIn: 'root' })
export class SubscriptionsApi {
  private readonly http = inject(HttpClient);

  publicPlans(): Observable<SubscriptionPlan[]> {
    return this.http
      .get<ApiEnvelope<SubscriptionPlan[]>>(`${API_BASE}/public/subscription-plans`)
      .pipe(map((res) => res.data));
  }

  adminPlans(): Observable<SubscriptionPlan[]> {
    return this.http
      .get<ApiEnvelope<SubscriptionPlan[]>>(`${API_BASE}/admin/subscription-plans`)
      .pipe(map((res) => res.data));
  }

  create(body: PlanInput): Observable<SubscriptionPlan> {
    return this.http
      .post<ApiEnvelope<SubscriptionPlan>>(`${API_BASE}/admin/subscription-plans`, body)
      .pipe(map((res) => res.data));
  }

  update(id: string, body: Partial<PlanInput>): Observable<SubscriptionPlan> {
    return this.http
      .patch<ApiEnvelope<SubscriptionPlan>>(`${API_BASE}/admin/subscription-plans/${id}`, body)
      .pipe(map((res) => res.data));
  }
}
