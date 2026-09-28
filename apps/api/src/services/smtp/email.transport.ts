export interface EmailTransportInput {
  from: {
    email: string;
    name?: string;
  };
  recipient: string;
  subject: string;
  body: string;
}

export interface EmailTransportResult {
  messageId: string;
  previewUrl?: string;
}

export interface EmailTransport {
  send(input: EmailTransportInput): Promise<EmailTransportResult>;
  close(): Promise<void>;
}
