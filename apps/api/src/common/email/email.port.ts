export const EMAIL_PORT = 'EMAIL_PORT';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
