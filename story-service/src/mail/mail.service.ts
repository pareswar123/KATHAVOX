import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../config/app-config';
import { t } from '../i18n/i18n';

/**
 * Sends account emails. When SMTP_HOST is empty (local development),
 * the message is written to the server log instead, so flows can still be tested.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly cfg: AppConfig) {
    this.transporter = cfg.mail.host
      ? nodemailer.createTransport({
          host: cfg.mail.host,
          port: cfg.mail.port,
          secure: cfg.mail.port === 465,
          auth: cfg.mail.user ? { user: cfg.mail.user, pass: cfg.mail.password } : undefined,
        })
      : null;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      // Development fallback. Never log in production, because the text contains one-time links.
      if (!this.cfg.isProduction) {
        this.logger.warn(`[dev mail] to=${to} subject="${subject}"\n${text}`);
      }
      return;
    }
    const info = await this.transporter.sendMail({ from: this.cfg.mail.from, to, subject, text });
    // Recipient is logged so a tester can match each sent email to the address they registered.
    this.logger.log(`[mail] sent to=${to} from=${this.cfg.mail.from} subject="${subject}" response=${info.response}`);
  }

  /** Builds an email from en.json templates, with the brand and TTL taken from config. */
  verificationEmail(link: string): { subject: string; text: string } {
    return this.template('verify', link, this.cfg.tokens.emailVerificationTtlMs);
  }

  resetEmail(link: string): { subject: string; text: string } {
    return this.template('reset', link, this.cfg.tokens.passwordResetTtlMs);
  }

  setPasswordEmail(link: string): { subject: string; text: string } {
    const params = { brand: this.cfg.appName, link, hours: 24 };
    return { subject: t('mail.setPasswordSubject', params), text: t('mail.setPasswordBody', params) };
  }

  /** Welcome email for a reader who registered on the site (not a purchase). */
  welcomeEmail(link: string): { subject: string; text: string } {
    const params = { brand: this.cfg.appName, link, hours: 24 };
    return { subject: t('mail.welcomeSubject', params), text: t('mail.welcomeBody', params) };
  }

  private template(kind: 'verify' | 'reset', link: string, ttlMs: number) {
    const params = { brand: this.cfg.appName, link, hours: Math.round(ttlMs / 3_600_000) };
    return kind === 'verify'
      ? { subject: t('mail.verifySubject', params), text: t('mail.verifyBody', params) }
      : { subject: t('mail.resetSubject', params), text: t('mail.resetBody', params) };
  }
}
