export interface IStripeSubscription {
  id: string;
  status: string;
  clientSecret: string | null;
  currentPeriodStart: number; // unix seconds
  currentPeriodEnd: number;   // unix seconds
  paymentIntentStatus: string | null;
}