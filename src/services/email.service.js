const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    async sendEmail(to, subject, html) {
        try {
            const info = await this.transporter.sendMail({
                from: `"${process.env.BUSINESS_NAME || 'WhatsApp Store'}" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html,
            });
            console.log('Email sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Email send error:', error);
            // Don't throw error to avoid breaking the main flow, just log it
            return null;
        }
    }

    async sendOrderConfirmation(order, user) {
        if (!user.email) return null;

        const subject = `Order Confirmation - #${order.orderNumber}`;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h1 style="color: #2563eb; text-align: center;">Order Confirmed!</h1>
        <p>Dear ${user.name},</p>
        <p>Thank you for your order. We've received your order <strong>#${order.orderNumber}</strong> and it's being processed.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          <p>Total Amount: <strong>₹${parseFloat(order.totalAmount).toLocaleString()}</strong></p>
          <p>Status: <strong>${order.status}</strong></p>
        </div>

        <h3>Shipping Address</h3>
        <p style="color: #4b5563;">
          ${order.deliveryAddress ? `
            ${order.deliveryAddress.fullName}<br>
            ${order.deliveryAddress.addressLine1}${order.deliveryAddress.addressLine2 ? ', ' + order.deliveryAddress.addressLine2 : ''}<br>
            ${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}
          ` : 'No address specified'}
        </p>

        <p style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 0.875rem;">
          Thanks for choosing ${process.env.BUSINESS_NAME || 'WhatsApp Store'}!
        </p>
      </div>
    `;

        return this.sendEmail(user.email, subject, html);
    }

    async sendStatusUpdate(order, user) {
        if (!user.email) return null;

        const subject = `Update on your Order #${order.orderNumber}`;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #2563eb;">Your order status has changed</h2>
        <p>Hi ${user.name},</p>
        <p>Your order <strong>#${order.orderNumber}</strong> is now in <strong>${order.status}</strong> status.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p>Track your order progress through our WhatsApp chat.</p>
        </div>

        <p>If you have any questions, feel free to reply to this email.</p>
      </div>
    `;

        return this.sendEmail(user.email, subject, html);
    }
}

module.exports = new EmailService();
