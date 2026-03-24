export type SubscriptionPlan = 'basic' | 'pro' | 'agency'

export const PLAN_IDS: SubscriptionPlan[] = ['basic', 'pro', 'agency']

export function isSubscriptionPlan(s: string | null | undefined): s is SubscriptionPlan {
  return s === 'basic' || s === 'pro' || s === 'agency'
}
