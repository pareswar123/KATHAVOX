import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE } from '../config/endpoints';
import { ApiEnvelope } from '../http/api.types';

/** Body for creating a Razorpay order. The amount is calculated by the server, never sent by the browser. */
export interface CreateOrderInput {
  purchaseType: 'STORY_PURCHASE' | 'SUBSCRIPTION' | 'BOOK_PURCHASE';
  storyId?: string;
  planId?: string;
  bookId?: string;
  checkoutEmail: string;
  fullName?: string;
}

/** Order returned by the server, used to open Razorpay Checkout. */
export interface OrderResponse {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  paymentId: string;
}

/** Proof of payment returned by Razorpay Checkout, sent back for confirmation. */
export interface VerifyInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentResult {
  status: string;
  purchaseType?: string;
  accountCreated?: boolean;
}

export interface AdminPaymentRow {
  id: string;
  occurredAt: string;
  type: 'STORY_PURCHASE' | 'SUBSCRIPTION';
  item: string;
  buyerEmail: string;
  amountPaise: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  orderId: string;
  paymentId: string | null;
}

export interface AdminPaymentsResponse {
  items: AdminPaymentRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  range: { from: string; to: string };
  totals: { rows: number; successPaise: number };
}

export interface AdminPaymentsParams {
  from?: string;
  to?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}

/** Checkout calls for readers, and the admin payments list. */
@Injectable({ providedIn: 'root' })
export class PaymentsApi {
  private readonly http = inject(HttpClient);

  createOrder(body: CreateOrderInput): Observable<OrderResponse> {
    return this.http
      .post<ApiEnvelope<OrderResponse>>(`${API_BASE}/payments/create-order`, body)
      .pipe(map((res) => res.data));
  }

  verify(proof: VerifyInput): Observable<PaymentResult> {
    return this.http.post<ApiEnvelope<PaymentResult>>(`${API_BASE}/payments/verify`, proof).pipe(map((res) => res.data));
  }

  recover(orderId: string): Observable<PaymentResult> {
    return this.http
      .post<ApiEnvelope<PaymentResult>>(`${API_BASE}/payments/recover`, { orderId })
      .pipe(map((res) => res.data));
  }

  /** Excel file of every payment matching the filter (all rows, not one page). */
  exportAdmin(params: Omit<AdminPaymentsParams, 'page' | 'limit'>): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.type) httpParams = httpParams.set('type', params.type);
    return this.http.get(`${API_BASE}/admin/payments/export`, { params: httpParams, responseType: 'blob' });
  }

  adminPayments(params: AdminPaymentsParams): Observable<AdminPaymentsResponse> {
    let httpParams = new HttpParams().set('page', params.page ?? 1).set('limit', params.limit ?? 20);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.type) httpParams = httpParams.set('type', params.type);
    return this.http
      .get<ApiEnvelope<AdminPaymentsResponse>>(`${API_BASE}/admin/payments`, { params: httpParams })
      .pipe(map((res) => res.data));
  }
}
