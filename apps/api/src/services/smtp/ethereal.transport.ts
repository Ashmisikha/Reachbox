import nodemailer, { type Transporter } from 'nodemailer';
import { smtpConfig, validateSmtpCredentials } from '../../config/smtp';
import type {
  EmailTransport,
  EmailTransportInput,
  EmailTransportResult,
} from './email.transport';

export class EtherealEmailTransport implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(customConfig?: Partial<typeof smtpConfig>) {
    const config = { ...smtpConfig, ...customConfig };
    validateSmtpCredentials(config.user, config.password);

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
      pool: config.pool,
      maxConnections: config.maxConnections,
      maxMessages: config.maxMessages,
    });
  }

  async send(input: EmailTransportInput): Promise<EmailTransportResult> {
    const info = await this.transporter.sendMail({
      from: {
        address: input.from.email,
        name: input.from.name,
      },
      to: input.recipient,
      subject: input.subject,
      text: input.body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined,
    };
  }

  async close(): Promise<void> {
    this.transporter.close();
  }
}
