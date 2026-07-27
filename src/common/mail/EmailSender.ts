import nodemailer, { Transporter } from "nodemailer";
import ENV from "../constants/ENV";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

class NodemailerEmailSender implements EmailSender {
  public constructor(private readonly transporter: Transporter) {}

  public async send(message: EmailMessage) {
    await this.transporter.sendMail({
      from: {
        name: ENV.MailFromName,
        address: ENV.MailFrom,
      },
      ...message,
    });
  }
}

function createTransporter() {
  if (ENV.MailProvider === "json") {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: ENV.SmtpHost,
    port: ENV.SmtpPort,
    secure: ENV.SmtpSecure,
    auth:
      ENV.SmtpUser && ENV.SmtpPassword
        ? { user: ENV.SmtpUser, pass: ENV.SmtpPassword }
        : undefined,
  });
}

export const emailSender: EmailSender = new NodemailerEmailSender(
  createTransporter()
);
