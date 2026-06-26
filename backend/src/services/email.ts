import { Resend } from 'resend';
import { config } from '../config';
import { AppError } from '../middleware/error';

let resend: Resend | null = null;

function getClient(): Resend {
  if (!resend) {
    if (!config.resend.apiKey) {
      throw new AppError(503, 'Resend API key not configured');
    }
    resend = new Resend(config.resend.apiKey);
  }
  return resend;
}

export async function sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
  try {
    const client = getClient();
    const verificationUrl = `${config.frontendUrl}/auth/verify-email?token=${token}`;

    await client.emails.send({
      from: config.resend.from,
      to: email,
      subject: 'Verify your FinanceAI account',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f9fafb;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="font-size: 24px; margin: 0 0 8px; color: #111827;">Welcome to FinanceAI 🎉</h1>
            <p style="color: #6b7280; margin: 0 0 24px; line-height: 1.5;">Hi ${name}, click the button below to verify your email address and get started.</p>
            <a href="${verificationUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">Verify Email</a>
            <p style="color: #9ca3af; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error.message);
    // Don't throw - email failure shouldn't block registration
  }
}

export async function sendPasswordResetEmail(email: string, token: string, name: string): Promise<void> {
  try {
    const client = getClient();
    const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${token}`;

    await client.emails.send({
      from: config.resend.from,
      to: email,
      subject: 'Reset your FinanceAI password',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f9fafb;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="font-size: 24px; margin: 0 0 8px; color: #111827;">Reset Your Password 🔐</h1>
            <p style="color: #6b7280; margin: 0 0 24px; line-height: 1.5;">Hi ${name}, click the button below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">Reset Password</a>
            <p style="color: #9ca3af; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error: any) {
    console.error('❌ Failed to send password reset email:', error.message);
  }
}

export async function sendWeeklyReportEmail(email: string, name: string, reportHtml: string): Promise<void> {
  try {
    const client = getClient();

    await client.emails.send({
      from: config.resend.from,
      to: email,
      subject: 'Your FinanceAI Weekly Report',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f9fafb;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="font-size: 24px; margin: 0 0 8px; color: #111827;">Weekly Financial Report 📊</h1>
            <p style="color: #6b7280; margin: 0 0 24px; line-height: 1.5;">Hi ${name}, here's your financial summary for this week.</p>
            ${reportHtml}
          </div>
        </body>
        </html>
      `,
    });
    console.log(`✅ Weekly report sent to ${email}`);
  } catch (error: any) {
    console.error('❌ Failed to send weekly report:', error.message);
  }
}
