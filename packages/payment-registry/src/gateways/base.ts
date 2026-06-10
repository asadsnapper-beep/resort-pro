import type {
  GatewayId,
  GatewayMeta,
  GatewayCredentials,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  RefundInput,
  RefundResult,
} from '../types.js';

export abstract class BaseGateway {
  abstract readonly meta: GatewayMeta;

  get id(): GatewayId { return this.meta.id; }
  get name(): string  { return this.meta.name; }

  /** Start a payment — returns redirect URL or inline data */
  abstract initiate(
    input: InitiatePaymentInput,
    credentials: GatewayCredentials,
  ): Promise<InitiatePaymentResult>;

  /** Verify a payment from webhook or return URL callback */
  abstract verify(
    input: VerifyPaymentInput,
    credentials: GatewayCredentials,
  ): Promise<VerifyPaymentResult>;

  /** Refund a payment (optional — not all gateways support it) */
  refund?(input: RefundInput): Promise<RefundResult>;

  /** Verify webhook signature — returns true if valid */
  verifyWebhookSignature?(
    rawBody: string,
    headers: Record<string, string>,
    credentials: GatewayCredentials,
  ): boolean;
}

/** Used for Phase 2/3 gateways — stub that throws NotImplementedError */
export class StubGateway extends BaseGateway {
  constructor(public readonly meta: GatewayMeta) {
    super();
  }

  async initiate(): Promise<InitiatePaymentResult> {
    throw new Error(`Gateway "${this.meta.name}" is not yet implemented. Coming in Phase 2.`);
  }

  async verify(): Promise<VerifyPaymentResult> {
    throw new Error(`Gateway "${this.meta.name}" is not yet implemented. Coming in Phase 2.`);
  }
}
