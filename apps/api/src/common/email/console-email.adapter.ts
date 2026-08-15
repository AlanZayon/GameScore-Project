import { Injectable, Logger } from '@nestjs/common';

import type { EmailMessage, EmailPort } from './email.port';

@Injectable()
export class ConsoleEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);
  lastMessage: EmailMessage | null = null;

  async send(message: EmailMessage): Promise<void> {
    this.lastMessage = message;
    this.logger.log(`Email to ${message.to}: ${message.subject}\n${message.text}`);
  }
}
