import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

import { AppConfigService } from '../config/app-config.service';
import type { EmailMessage, EmailPort } from './email.port';

@Injectable()
export class SmtpEmailAdapter implements EmailPort {
  private readonly logger = new Logger(SmtpEmailAdapter.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: AppConfigService) {
    const smtp = config.smtp;
    if (!smtp) {
      throw new Error('SmtpEmailAdapter requires SMTP configuration');
    }

    this.from = smtp.from;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass ?? '' } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    this.logger.log(`Email sent to ${message.to}: ${message.subject}`);
  }
}
