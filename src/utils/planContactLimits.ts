import type { SubscriptionPlan } from '../types/plan'

/** Maksimalan broj kontakata (vlasnik + dodati) po planu */
export function maxContactsForPlan(plan: SubscriptionPlan): number {
  if (plan === 'basic') return 2
  if (plan === 'pro') return 5
  return 99
}
