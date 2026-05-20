import { Controller, Post, Body, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/database/prisma.service';

@ApiTags('webhooks')
@Controller('settings/webhooks')
export class PaymentsWebhookController {
  constructor(private prisma: PrismaService) {}

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
    const randomInvoiceSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomInvoiceSuffix}`;

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
  async handleStripeWebhook(@Body() body: any) {
    // Process Stripe successful charge event
    // Valid Stripe charge payload structure: { type: "charge.succeeded", data: { object: { ... } } }
    const eventType = body?.type;
    if (eventType && eventType !== 'charge.succeeded' && eventType !== 'payment_intent.succeeded') {
      return { received: true, ignored: true, reason: 'Event type not handled' };
    }

    const object = body?.data?.object || body;
    const amountRaw = object?.amount || 9900; // in cents
    const amount = amountRaw / 100;
    const currency = object?.currency || 'USD';
    const referenceId = object?.id || `ch_${Date.now()}`;
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
  async handlePayGWebhook(@Body() body: any) {
    // Process PayG successful captured payment event
    // Payload structure: { event: "payment.captured", payload: { payment: { entity: { ... } } } }
    const eventType = body?.event;
    if (eventType && eventType !== 'payment.captured' && eventType !== 'order.paid') {
      return { received: true, ignored: true, reason: 'Event type not handled' };
    }

    const paymentEntity = body?.payload?.payment?.entity || body;
    const amountRaw = paymentEntity?.amount || 799900; // in paise
    const amount = amountRaw / 100;
    const currency = paymentEntity?.currency || 'INR';
    const referenceId = paymentEntity?.id || `pay_${Date.now()}`;
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
