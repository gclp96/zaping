import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresAt: Date;
  recipientName?: string;
};

@Injectable()
export class EmailService {
  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey) {
      throw new Error('RESEND_API_KEY must be defined');
    }

    if (!from) {
      throw new Error('EMAIL_FROM must be defined');
    }

    const resend = new Resend(apiKey);
    const greeting = input.recipientName
      ? `Hola ${input.recipientName},`
      : 'Hola,';
    const expiresAt = new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(input.expiresAt);

    const response = await resend.emails.send({
      from,
      to: input.to,
      subject: 'Restablece tu contraseña de Zaping',
      html: `
        <p>${greeting}</p>
        <p>Recibimos una solicitud para restablecer tu contraseña de Zaping.</p>
        <p>
          <a href="${input.resetUrl}">Restablecer contraseña</a>
        </p>
        <p>Este enlace expira en 30 minutos (${expiresAt}).</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      `,
      text: [
        greeting,
        '',
        'Recibimos una solicitud para restablecer tu contraseña de Zaping.',
        `Restablecer contraseña: ${input.resetUrl}`,
        `Este enlace expira en 30 minutos (${expiresAt}).`,
        'Si no solicitaste este cambio, puedes ignorar este correo.',
      ].join('\n'),
    });

    if (response.error) {
      throw new Error('Resend password reset email delivery failed');
    }
  }
}
