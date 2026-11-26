export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  durationDays: number;
  isActive: boolean;
}
