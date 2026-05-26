import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private resend: Resend | null = null;
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Email service initialized with Resend');
    } else {
      const smtpUser = this.config.get<string>('SMTP_USER');
      const smtpPass = this.config.get<string>('SMTP_PASS');
      if (smtpUser && smtpPass) {
        const host = this.config.get<string>('SMTP_HOST', 'smtp.ethereal.email');
        const port = parseInt(this.config.get<string>('SMTP_PORT', '587'), 10);
        const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
        this.logger.log(`Email service initialized with SMTP at ${host}:${port}`);
      } else {
        this.logger.warn('Neither RESEND_API_KEY nor SMTP credentials set — email verification will log links to console');
      }
    }
    this.fromEmail = this.config.get<string>('FROM_EMAIL', 'QS Asset <noreply@qsasset.com>');
    this.appUrl = this.config.get<string>('APP_URL', 'https://qsasset.vercel.app');
  }

  /**
   * Generate a verification token and send verification email.
   * Returns the token (useful for testing).
   */
  async sendVerificationEmail(userId: string, email: string, firstName: string): Promise<string> {
    const token = uuidv4();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in the user record
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyToken: token,
        emailVerifyExpiry: expiry,
        emailVerified: false,
      },
    });

    const verifyUrl = `${this.appUrl}/verify-email?token=${token}`;

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject: 'Verify your QS Asset Management account',
          html: this.buildVerificationHtml(firstName, verifyUrl),
        });
        this.logger.log(`Verification email sent to ${email}`);
      } catch (err: any) {
        this.logger.error(`Failed to send verification email: ${err.message}`);
        // Don't block registration — log and continue
      }
    } else if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to: email,
          subject: 'Verify your QS Asset Management account',
          html: this.buildVerificationHtml(firstName, verifyUrl),
        });
        this.logger.log(`Verification email sent (SMTP) to ${email}`);
      } catch (err: any) {
        this.logger.error(`Failed to send verification email (SMTP): ${err.message}`);
      }
    } else {
      this.logger.warn(`No email provider configured — verification link: ${verifyUrl}`);
    }

    return token;
  }

  /**
   * Verify the token and mark the user as email-verified.
   */
  async verifyToken(token: string): Promise<{ success: boolean; message: string; email?: string }> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      return { success: false, message: 'Invalid or expired verification link.' };
    }

    if (user.emailVerified) {
      return { success: true, message: 'Email already verified. You can sign in.', email: user.email };
    }

    if (user.emailVerifyExpiry && new Date() > user.emailVerifyExpiry) {
      return { success: false, message: 'Verification link has expired. Please request a new one.' };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    this.logger.log(`Email verified for ${user.email}`);
    return { success: true, message: 'Email verified successfully! You can now sign in.', email: user.email };
  }

  /**
   * Resend verification email for an existing unverified user.
   */
  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      return { success: false, message: 'No account found with this email.' };
    }

    if (user.emailVerified) {
      return { success: true, message: 'Email is already verified.' };
    }

    await this.sendVerificationEmail(user.id, user.email, user.firstName);
    return { success: true, message: 'Verification email sent. Check your inbox.' };
  }

  private buildVerificationHtml(name: string, verifyUrl: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Inter', -apple-system, sans-serif; background: #0d1117; color: #e6edf3; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #161b22; border-radius: 12px; border: 1px solid #30363d; padding: 40px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); line-height: 48px; text-align: center; color: white; font-weight: 800; font-size: 18px;">QS</div>
          <h1 style="margin: 12px 0 0; font-size: 22px; color: #f0f6fc;">QS Asset Management</h1>
        </div>
        <h2 style="font-size: 18px; color: #f0f6fc; margin-bottom: 12px;">Welcome, ${name}!</h2>
        <p style="font-size: 14px; color: #8b949e; line-height: 1.6; margin-bottom: 24px;">
          Thank you for registering with QS Asset Management. Please verify your email address to activate your account and start managing your IT infrastructure.
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 8px;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 12px; color: #484f58; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #30363d; margin: 24px 0;">
        <p style="font-size: 11px; color: #484f58; text-align: center;">
          QS Asset Management — Enterprise IT Asset & Security Platform<br>
          <a href="${this.appUrl}" style="color: #06b6d4; text-decoration: none;">${this.appUrl}</a>
        </p>
      </div>
    </body>
    </html>`;
  }

  async sendResetPasswordEmail(userId: string, email: string, firstName: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject: 'Reset your QS Asset Management password',
          html: this.buildResetPasswordHtml(firstName, resetUrl),
        });
        this.logger.log(`Password reset email sent to ${email}`);
      } catch (err: any) {
        this.logger.error(`Failed to send password reset email: ${err.message}`);
      }
    } else if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to: email,
          subject: 'Reset your QS Asset Management password',
          html: this.buildResetPasswordHtml(firstName, resetUrl),
        });
        this.logger.log(`Password reset email sent (SMTP) to ${email}`);
      } catch (err: any) {
        this.logger.error(`Failed to send password reset email (SMTP): ${err.message}`);
      }
    } else {
      this.logger.warn(`No email provider configured — reset link: ${resetUrl}`);
    }
  }

  private buildResetPasswordHtml(name: string, resetUrl: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Inter', -apple-system, sans-serif; background: #0d1117; color: #e6edf3; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #161b22; border-radius: 12px; border: 1px solid #30363d; padding: 40px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); line-height: 48px; text-align: center; color: white; font-weight: 800; font-size: 18px;">QS</div>
          <h1 style="margin: 12px 0 0; font-size: 22px; color: #f0f6fc;">QS Asset Management</h1>
        </div>
        <h2 style="font-size: 18px; color: #f0f6fc; margin-bottom: 12px;">Hello, ${name}!</h2>
        <p style="font-size: 14px; color: #8b949e; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset your password for your QS Asset Management account. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 8px;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 12px; color: #484f58; line-height: 1.5;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #30363d; margin: 24px 0;">
        <p style="font-size: 11px; color: #484f58; text-align: center;">
          QS Asset Management — Enterprise IT Asset & Security Platform<br>
          <a href="${this.appUrl}" style="color: #06b6d4; text-decoration: none;">${this.appUrl}</a>
        </p>
      </div>
    </body>
    </html>`;
  }
}
