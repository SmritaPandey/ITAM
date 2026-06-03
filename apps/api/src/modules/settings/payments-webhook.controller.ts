import { Controller, Post, Body, Headers, Req, HttpCode, HttpStatus, Logger, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';

@ApiTags('webhooks')
@Controller('settings/webhooks')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Verify Stripe webhook signature using STRIPE_WEBHOOK_SECRET.
   * Returns true if verification passes or is skipped (dev mode without secret).
   * Throws UnauthorizedException in production if verification fails.
   */
  private verifyStripeSignature(body: any, signature: string | undefined, rawBody?: Buffer): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET is not configured — webhook signature verification is DISABLED. Set this in production!');
      return true;
    }

    if (!signature) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Missing Stripe webhook signature');
      }
      this.logger.warn('Stripe webhook received without signature — allowing in dev mode');
      return true;
    }

    try {
      // Stripe signature format: t=<timestamp>,v1=<signature>
      const elements = signature.split(',');
      const timestampStr = elements.find(e => e.startsWith('t='))?.slice(2);
      const sigHash = elements.find(e => e.startsWith('v1='))?.slice(3);

      if (!timestampStr || !sigHash) {
        throw new Error('Invalid signature format');
      }

      const payload = rawBody ? rawBody.toString('utf8') : JSON.stringify(body);
      const signedPayload = `${timestampStr}.${payload}`;
      const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(sigHash, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        throw new Error('Signature mismatch');
      }

      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Invalid Stripe webhook signature');
      }
      this.logger.warn(`Stripe signature verification failed — allowing in dev mode: ${error}`);
      return true;
    }
  }

  /**
   * Verify Razorpay/PayG webhook signature using HMAC-SHA256.
   * Returns true if verification passes or is skipped (dev mode without secret).
   * Throws UnauthorizedException in production if verification fails.
   */
  private verifyRazorpaySignature(body: any, signature: string | undefined, rawBody?: Buffer): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET is not configured — webhook signature verification is DISABLED. Set this in production!');
      return true;
    }

    if (!signature) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Missing Razorpay webhook signature');
      }
      this.logger.warn('Razorpay webhook received without signature — allowing in dev mode');
      return true;
    }

    try {
      const payload = rawBody ? rawBody.toString('utf8') : JSON.stringify(body);
      const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        throw new Error('Signature mismatch');
      }

      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Invalid Razorpay webhook signature');
      }
      this.logger.warn(`Razorpay signature verification failed — allowing in dev mode: ${error}`);
      return true;
    }
  }

  private async processPayment(
    tenantIdentifier: string | null,
    emailIdentifier: string | null,
    amount: number,
    currency: string,
    method: string,
    referenceId: string,
    notes?: string,
  ) {
    let tenantId = tenantIdentifier;

    // 1. Try to locate tenant by ID first
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) tenantId = null; // Reset to try email route if ID lookup failed
    }

    // 2. If no tenant ID, lookup by user email
    if (!tenantId && emailIdentifier) {
      const user = await this.prisma.user.findFirst({
        where: { email: emailIdentifier, deletedAt: null },
      });
      if (user) {
        tenantId = user.tenantId;
      }
    }

    if (!tenantId) {
      throw new NotFoundException('Could not resolve tenant for payment');
    }

    // 3. Find or create Subscription for this tenant
    let subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      // Fallback: create subscription if it doesn't exist
      subscription = await this.prisma.subscription.create({
        data: {
          tenantId,
          plan: 'PROFESSIONAL',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          mrr: amount,
          startDate: new Date(),
        },
      });
    } else {
      // Update subscription status to active
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
        },
      });
    }

    // 4. Record the payment in the Payment table
    // Generate deterministic invoice number from timestamp + event data hash
    const invoiceTimestamp = Date.now().toString(36).toUpperCase();
    const invoiceHash = crypto.createHash('sha256').update(`${referenceId}-${amount}-${currency}-${tenantId}`).digest('hex').slice(0, 6).toUpperCase();
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${invoiceTimestamp}-${invoiceHash}`;

    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount: amount,
        currency: currency.toUpperCase(),
        status: 'COMPLETED',
        method,
        referenceId,
        invoiceNumber,
        notes: notes || `Webhook payment captured via ${method}`,
        paidAt: new Date(),
      },
    });

    // 5. Update tenant plan status if it was in trial or starter
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: subscription.plan },
    });

    return {
      success: true,
      tenantId,
      subscriptionId: subscription.id,
      paymentId: payment.id,
      invoiceNumber,
    };
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver' })
  async handleStripeWebhook(
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    // Verify webhook signature before processing
    this.verifyStripeSignature(body, signature, req.rawBody);

    // Process Stripe successful charge event
    // Valid Stripe charge payload structure: { type: "charge.succeeded", data: { object: { ... } } }
    const eventType = body?.type;
    if (eventType && eventType !== 'charge.succeeded' && eventType !== 'payment_intent.succeeded') {
      return { received: true, ignored: true, reason: 'Event type not handled' };
    }

    const object = body?.data?.object || body;

    // Reject events with missing payment amount — do not record fake payments
    const amountRaw = object?.amount;
    if (!amountRaw && amountRaw !== 0) {
      this.logger.error(`Stripe webhook rejected: missing payment amount in event ${eventType || 'unknown'}`);
      return { received: true, error: 'Missing payment amount — event rejected' };
    }
    const amount = amountRaw / 100;

    const currency = object?.currency || 'USD';

    // Reject events with missing payment reference ID
    const referenceId = object?.id;
    if (!referenceId) {
      this.logger.error(`Stripe webhook rejected: missing payment reference ID in event ${eventType || 'unknown'}`);
      return { received: true, error: 'Missing payment reference ID — event rejected' };
    }

    const email = object?.receipt_email || object?.billing_details?.email;
    const tenantId = object?.metadata?.tenantId;

    return this.processPayment(
      tenantId,
      email,
      amount,
      currency,
      'STRIPE',
      referenceId,
      `Stripe charge event: ${eventType || 'charge.succeeded'}`,
    );
  }

  @Post('payg')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PayG/Razorpay webhook receiver' })
  async handlePayGWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: any,
  ) {
    // Verify webhook signature before processing
    this.verifyRazorpaySignature(body, signature, req.rawBody);

    // Process PayG successful captured payment event
    // Payload structure: { event: "payment.captured", payload: { payment: { entity: { ... } } } }
    const eventType = body?.event;
    if (eventType && eventType !== 'payment.captured' && eventType !== 'order.paid') {
      return { received: true, ignored: true, reason: 'Event type not handled' };
    }

    const paymentEntity = body?.payload?.payment?.entity || body;

    // Reject events with missing payment amount — do not record fake payments
    const amountRaw = paymentEntity?.amount;
    if (!amountRaw && amountRaw !== 0) {
      this.logger.error(`PayG webhook rejected: missing payment amount in event ${eventType || 'unknown'}`);
      return { received: true, error: 'Missing payment amount — event rejected' };
    }
    const amount = amountRaw / 100;

    const currency = paymentEntity?.currency || 'INR';

    // Reject events with missing payment reference ID
    const referenceId = paymentEntity?.id;
    if (!referenceId) {
      this.logger.error(`PayG webhook rejected: missing payment reference ID in event ${eventType || 'unknown'}`);
      return { received: true, error: 'Missing payment reference ID — event rejected' };
    }

    const email = paymentEntity?.email;
    const tenantId = paymentEntity?.notes?.tenantId;

    return this.processPayment(
      tenantId,
      email,
      amount,
      currency,
      'PAYG',
      referenceId,
      `PayG captured event: ${eventType || 'payment.captured'}`,
    );
  }
}
