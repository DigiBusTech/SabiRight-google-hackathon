import Paystack from 'paystack';

interface PaystackConfig {
  secretKey: string;
  publicKey: string;
}

interface InitializePaymentParams {
  email: string;
  amount: number; // in kobo (smallest currency unit)
  reference: string;
  currency?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
}

interface VerifyPaymentResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: Record<string, any>;
    fees: number;
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: Record<string, any>;
      risk_action: string;
    };
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
      account_name: string | null;
    };
  };
}

class PaystackService {
  private paystack: any;
  private secretKey: string;
  private publicKey: string;

  constructor(config: PaystackConfig) {
    this.secretKey = config.secretKey;
    this.publicKey = config.publicKey;
    this.paystack = Paystack(this.secretKey);
  }

  /**
   * Initialize a payment transaction
   */
  async initializePayment(params: InitializePaymentParams): Promise<{
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }> {
    try {
      const response = await this.paystack.transaction.initialize({
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        currency: params.currency || 'NGN',
        callback_url: params.callback_url,
        metadata: params.metadata,
      });

      return response;
    } catch (error: any) {
      console.error('Paystack initialization error:', error);
      throw new Error(error.message || 'Failed to initialize payment');
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    try {
      const response = await this.paystack.transaction.verify(reference);
      return response;
    } catch (error: any) {
      console.error('Paystack verification error:', error);
      throw new Error(error.message || 'Failed to verify payment');
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');
    return hash === signature;
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: number): Promise<any> {
    try {
      const response = await this.paystack.transaction.get(transactionId);
      return response;
    } catch (error: any) {
      console.error('Paystack get transaction error:', error);
      throw new Error(error.message || 'Failed to get transaction');
    }
  }

  /**
   * List transactions
   */
  async listTransactions(params?: {
    perPage?: number;
    page?: number;
    customer?: string;
    status?: 'success' | 'failed' | 'abandoned';
    from?: string;
    to?: string;
  }): Promise<any> {
    try {
      const response = await this.paystack.transaction.list(params);
      return response;
    } catch (error: any) {
      console.error('Paystack list transactions error:', error);
      throw new Error(error.message || 'Failed to list transactions');
    }
  }

  /**
   * Get public key for frontend
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}

export default PaystackService;
export type { PaystackConfig, InitializePaymentParams, VerifyPaymentResponse };
