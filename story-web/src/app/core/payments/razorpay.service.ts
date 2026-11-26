import { Injectable } from '@angular/core';
import { OrderResponse, VerifyInput } from '../api/payments.api';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: () => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

/**
 * Opens Razorpay Checkout and resolves only when the buyer pays (handler).
 * A failed attempt (wrong card, wrong OTP) keeps the window open for a retry, so it is reported
 * through onAttemptFailed instead of rejecting. Rejects with 'CANCELLED' when the buyer closes the window.
 */
@Injectable({ providedIn: 'root' })
export class RazorpayService {
  private loading: Promise<void> | null = null;

  checkout(
    order: OrderResponse,
    prefill: { name: string; email: string },
    description: string,
    onAttemptFailed: () => void,
  ): Promise<VerifyInput> {
    return this.load().then(
      () =>
        new Promise<VerifyInput>((resolve, reject) => {
          const Ctor = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
          const instance = new Ctor({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: 'KATHAVOX',
            description,
            order_id: order.orderId,
            prefill: { name: prefill.name, email: prefill.email },
            theme: { color: '#4f46e5' },
            handler: (response: VerifyInput) => resolve(response),
            modal: { ondismiss: () => reject(new Error('CANCELLED')) },
          });
          instance.on('payment.failed', () => onAttemptFailed());
          instance.open();
        }),
    );
  }

  private load(): Promise<void> {
    if (typeof window === 'undefined') return Promise.reject(new Error('BROWSER_ONLY'));
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
    if (!this.loading) {
      this.loading = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.onload = () => resolve();
        script.onerror = () => {
          this.loading = null;
          reject(new Error('SCRIPT'));
        };
        document.head.appendChild(script);
      });
    }
    return this.loading;
  }
}
