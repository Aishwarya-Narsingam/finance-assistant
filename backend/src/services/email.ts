import { Resend } from 'resend';
import { config } from '../config';

const resend = new Resend(config.resend.apiKey);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    await resend.emails.send({
      from: config.resend.from,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    // Don't throw — email failures shouldn't break the flow
  }
}

export function verificationEmailHtml(name: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Inter, sans-serif; background: #ffffff; color: #111827; padding: 40px;">
      <div style="max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome to FinanceAI</h1>
        <p style="color: #6B7280; margin-bottom: 24px;">Hi ${name},</p>
        <p style="color: #6B7280; margin-bottom: 24px;">Please verify your email address to get started with FinanceAI.</p>
        <a href="${verificationUrl}" style="display: inline-block; background: #000000; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Verify Email</a>
        <p style="color: #6B7280; margin-top: 24px; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}

export function passwordResetHtml(name: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Inter, sans-serif; background: #ffffff; color: #111827; padding: 40px;">
      <div style="max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Reset Your Password</h1>
        <p style="color: #6B7280; margin-bottom: 24px;">Hi ${name},</p>
        <p style="color: #6B7280; margin-bottom: 24px;">You requested a password reset. Click the button below to set a new password.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #000000; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Reset Password</a>
        <p style="color: #6B7280; margin-top: 24px; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}
