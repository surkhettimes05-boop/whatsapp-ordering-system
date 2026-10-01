const crypto = require('crypto');
const prisma = require('../config/database');

function baseUrl() {
  const value = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!value || !/^https:\/\//i.test(value)) {
    throw new Error('PUBLIC_BASE_URL must be a public HTTPS URL for online payments');
  }
  return value;
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'khalti' || provider === 'esewa') return provider;
  throw new Error('Unsupported payment provider. Use khalti or esewa.');
}

function money(value) {
  return Number(value).toFixed(2);
}

function safeJson(value) {
  try { return JSON.stringify(value); } catch { return '{}'; }
}

class PaymentService {
  isConfigured(provider) {
    const p = normalizeProvider(provider);
    if (p === 'khalti') return Boolean(process.env.KHALTI_SECRET_KEY && process.env.PUBLIC_BASE_URL);
    return Boolean(
      process.env.ESEWA_SECRET_KEY &&
      process.env.ESEWA_PRODUCT_CODE &&
      process.env.PUBLIC_BASE_URL
    );
  }

  configuredProviders() {
    return ['khalti', 'esewa'].filter(provider => {
      try { return this.isConfigured(provider); } catch { return false; }
    });
  }

  async initiate(orderId, provider) {
    const p = normalizeProvider(provider);
    if (!this.isConfigured(p)) {
      throw new Error(`${p.toUpperCase()} payment is not configured`);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { retailer: true }
    });
    if (!order) throw new Error('Order not found');
    if (Number(order.totalAmount) <= 0) throw new Error('Order amount must be greater than zero');

    const existing = await prisma.commercePaymentTransaction.findFirst({
      where: {
        orderId,
        provider: p,
        status: { in: ['PENDING', 'PAID'] }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (existing?.status === 'PAID') return existing;
    if (existing?.checkoutUrl && existing.status === 'PENDING') return existing;

    if (p === 'khalti') return this.initiateKhalti(order);
    return this.initiateEsewa(order);
  }

  khaltiBase() {
    if (process.env.KHALTI_BASE_URL) return String(process.env.KHALTI_BASE_URL).replace(/\/$/, '');
    return String(process.env.KHALTI_ENV || 'sandbox').toLowerCase() === 'production'
      ? 'https://khalti.com/api/v2'
      : 'https://dev.khalti.com/api/v2';
  }

  async initiateKhalti(order) {
    const root = baseUrl();
    const amountPaisa = Math.round(Number(order.totalAmount) * 100);
    const payload = {
      return_url: `${root}/api/v1/shopping/payments/khalti/callback`,
      website_url: root,
      amount: amountPaisa,
      purchase_order_id: order.orderNumber,
      purchase_order_name: `Order ${order.orderNumber}`,
      customer_info: {
        name: order.deliveryName || order.retailer?.ownerName || order.retailer?.pasalName || 'Customer',
        email: order.retailer?.email || undefined,
        phone: order.deliveryPhone || order.retailer?.phoneNumber || undefined
      }
    };

    const response = await fetch(`${this.khaltiBase()}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.pidx || !body.payment_url) {
      throw new Error(`Khalti initiate failed: ${body.detail || body.error_key || response.status}`);
    }

    const payment = await prisma.commercePaymentTransaction.create({
      data: {
        orderId: order.id,
        provider: 'khalti',
        amount: order.totalAmount,
        status: 'PENDING',
        externalId: body.pidx,
        checkoutUrl: body.payment_url,
        metadata: safeJson({ expires_at: body.expires_at, expires_in: body.expires_in })
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMode: 'ONLINE',
        paymentProvider: 'khalti',
        paymentStatus: 'PENDING',
        paymentUrl: body.payment_url
      }
    });

    return payment;
  }

  async verifyKhalti(pidx) {
    if (!pidx) throw new Error('Missing Khalti pidx');
    const payment = await prisma.commercePaymentTransaction.findUnique({ where: { externalId: pidx } });
    if (!payment) throw new Error('Payment transaction not found');

    const response = await fetch(`${this.khaltiBase()}/epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pidx })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Khalti lookup failed: ${body.detail || response.status}`);

    const expectedPaisa = Math.round(Number(payment.amount) * 100);
    if (Number(body.total_amount) !== expectedPaisa) {
      await this.mark(payment, 'FAILED', body.transaction_id || pidx, body);
      throw new Error('Khalti amount mismatch');
    }

    const state = String(body.status || '').toLowerCase();
    const status = state === 'completed'
      ? 'PAID'
      : state.includes('cancel') || state.includes('expired')
        ? 'CANCELLED'
        : state === 'pending' || state === 'initiated'
          ? 'PENDING'
          : 'FAILED';

    await this.mark(payment, status, body.transaction_id || pidx, body);
    return { payment, status, providerResponse: body };
  }

  esewaEnvironment() {
    const production = String(process.env.ESEWA_ENV || 'sandbox').toLowerCase() === 'production';
    return {
      formUrl: process.env.ESEWA_FORM_URL || (production
        ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
        : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'),
      statusUrl: process.env.ESEWA_STATUS_URL || (production
        ? 'https://epay.esewa.com.np/api/epay/transaction/status/'
        : 'https://uat.esewa.com.np/api/epay/transaction/status/')
    };
  }

  esewaSignature(fields) {
    const signedFieldNames = fields.signed_field_names;
    const message = signedFieldNames
      .split(',')
      .map(name => `${name}=${fields[name]}`)
      .join(',');
    return crypto
      .createHmac('sha256', process.env.ESEWA_SECRET_KEY)
      .update(message)
      .digest('base64');
  }

  async initiateEsewa(order) {
    const root = baseUrl();
    const amount = money(order.totalAmount);
    const transactionUuid = order.orderNumber.replace(/[^A-Za-z0-9-]/g, '-');
    const fields = {
      amount,
      tax_amount: '0',
      total_amount: amount,
      transaction_uuid: transactionUuid,
      product_code: process.env.ESEWA_PRODUCT_CODE,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: `${root}/api/v1/shopping/payments/esewa/success`,
      failure_url: `${root}/api/v1/shopping/payments/esewa/failure`,
      signed_field_names: 'total_amount,transaction_uuid,product_code'
    };
    fields.signature = this.esewaSignature(fields);

    const payment = await prisma.commercePaymentTransaction.create({
      data: {
        orderId: order.id,
        provider: 'esewa',
        amount: order.totalAmount,
        status: 'PENDING',
        externalId: transactionUuid,
        metadata: safeJson(fields)
      }
    });

    const checkoutUrl = `${root}/api/v1/shopping/payments/esewa/${payment.id}/pay`;
    const updated = await prisma.commercePaymentTransaction.update({
      where: { id: payment.id },
      data: { checkoutUrl }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMode: 'ONLINE',
        paymentProvider: 'esewa',
        paymentStatus: 'PENDING',
        paymentUrl: checkoutUrl
      }
    });

    return updated;
  }

  async renderEsewaForm(paymentId) {
    const payment = await prisma.commercePaymentTransaction.findUnique({ where: { id: paymentId } });
    if (!payment || payment.provider !== 'esewa') throw new Error('eSewa payment not found');
    if (payment.status !== 'PENDING') throw new Error('Payment is no longer pending');

    const fields = JSON.parse(payment.metadata || '{}');
    const action = this.esewaEnvironment().formUrl;
    const escape = value => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

    const inputs = Object.entries(fields)
      .map(([key, value]) => `<input type="hidden" name="${escape(key)}" value="${escape(value)}">`)
      .join('');

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening eSewa…</title></head><body><form id="pay" method="POST" action="${escape(action)}">${inputs}<noscript><button type="submit">Continue to eSewa</button></noscript></form><script>document.getElementById('pay').submit()</script></body></html>`;
  }

  decodeEsewaPayload(encoded) {
    if (!encoded) throw new Error('Missing eSewa response');
    const text = Buffer.from(String(encoded), 'base64').toString('utf8');
    return JSON.parse(text);
  }

  verifyEsewaCallbackSignature(payload) {
    if (!payload?.signature || !payload?.signed_field_names) return false;
    const expected = this.esewaSignature(payload);
    const a = Buffer.from(String(expected));
    const b = Buffer.from(String(payload.signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async verifyEsewaPayload(payload) {
    if (!this.verifyEsewaCallbackSignature(payload)) {
      throw new Error('Invalid eSewa callback signature');
    }

    const transactionUuid = payload.transaction_uuid;
    const payment = await prisma.commercePaymentTransaction.findUnique({ where: { externalId: transactionUuid } });
    if (!payment) throw new Error('Payment transaction not found');

    if (Number(String(payload.total_amount).replaceAll(',', '')) !== Number(payment.amount)) {
      await this.mark(payment, 'FAILED', payload.transaction_code || transactionUuid, payload);
      throw new Error('eSewa amount mismatch');
    }

    const params = new URLSearchParams({
      product_code: process.env.ESEWA_PRODUCT_CODE,
      total_amount: money(payment.amount),
      transaction_uuid: transactionUuid
    });
    const response = await fetch(`${this.esewaEnvironment().statusUrl}?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`eSewa status check failed: ${response.status}`);

    const state = String(body.status || '').toUpperCase();
    const status = state === 'COMPLETE'
      ? 'PAID'
      : state === 'PENDING' || state === 'AMBIGUOUS'
        ? 'PENDING'
        : state.includes('REFUND')
          ? 'REFUNDED'
          : state === 'CANCELED'
            ? 'CANCELLED'
            : 'FAILED';

    await this.mark(payment, status, body.ref_id || payload.transaction_code || transactionUuid, body);
    return { payment, status, providerResponse: body };
  }

  async mark(payment, status, reference, providerResponse = null) {
    const updated = await prisma.commercePaymentTransaction.update({
      where: { id: payment.id },
      data: {
        status,
        metadata: providerResponse ? safeJson(providerResponse) : payment.metadata
      }
    });
    const order = await prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: status,
        paymentReference: reference || payment.externalId,
        paymentProvider: payment.provider
      },
      include: { retailer: true }
    });

    if (order.retailer?.whatsappNumber && ['PAID','FAILED','CANCELLED','REFUNDED'].includes(status)) {
      setImmediate(async () => {
        try {
          const whatsappService = require('./whatsapp.service');
          const labels = {
            PAID: '✅ Payment received',
            FAILED: '❌ Payment failed',
            CANCELLED: '⚠️ Payment cancelled',
            REFUNDED: '↩️ Payment refunded'
          };
          await whatsappService.sendMessage(
            order.retailer.whatsappNumber,
            `${labels[status]} for order *${order.orderNumber}*.\nProvider: ${payment.provider.toUpperCase()}\nAmount: Rs. ${order.totalAmount}`,
            { immediate: true }
          );
        } catch {}
      });
    }
    return updated;
  }
}

module.exports = new PaymentService();
