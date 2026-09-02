import { EmailService } from './email.service';

const mockSend = jest.fn();

type ResendEmailSendCall = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('EmailService', () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousEmailFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'Zaping <no-reply@example.com>';
  });

  afterAll(() => {
    if (previousApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previousApiKey;
    }

    if (previousEmailFrom === undefined) {
      delete process.env.EMAIL_FROM;
    } else {
      process.env.EMAIL_FROM = previousEmailFrom;
    }
  });

  it('sends password reset email through Resend with html and text content', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    const service = new EmailService();

    await service.sendPasswordResetEmail({
      to: 'ada@example.com',
      resetUrl: 'https://zaping.example/reset-password?token=secret-token',
      expiresAt: new Date('2026-09-01T17:00:00.000Z'),
      recipientName: 'Ada',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Zaping <no-reply@example.com>',
        to: 'ada@example.com',
        subject: 'Restablece tu contraseña de Zaping',
        html: expect.stringContaining(
          'https://zaping.example/reset-password?token=secret-token',
        ) as string,
        text: expect.stringContaining(
          'https://zaping.example/reset-password?token=secret-token',
        ) as string,
      }),
    );
    const sendCalls = mockSend.mock.calls as [ResendEmailSendCall][];
    expect(sendCalls[0][0].html).toContain('Hola Ada,');
    expect(sendCalls[0][0].text).toContain('expira en 30 minutos');
  });

  it('fails explicitly when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const service = new EmailService();
    await expect(
      service.sendPasswordResetEmail({
        to: 'ada@example.com',
        resetUrl: 'https://zaping.example/reset-password?token=secret-token',
        expiresAt: new Date('2026-09-01T17:00:00.000Z'),
      }),
    ).rejects.toThrow('RESEND_API_KEY must be defined');
  });

  it('fails explicitly when EMAIL_FROM is missing', async () => {
    const service = new EmailService();

    process.env.RESEND_API_KEY = 're_test_key';
    delete process.env.EMAIL_FROM;
    await expect(
      service.sendPasswordResetEmail({
        to: 'ada@example.com',
        resetUrl: 'https://zaping.example/reset-password?token=secret-token',
        expiresAt: new Date('2026-09-01T17:00:00.000Z'),
      }),
    ).rejects.toThrow('EMAIL_FROM must be defined');
  });

  it('propagates provider errors for application-level compensation', async () => {
    const providerError = new Error('provider unavailable');
    mockSend.mockRejectedValue(providerError);
    const service = new EmailService();

    await expect(
      service.sendPasswordResetEmail({
        to: 'ada@example.com',
        resetUrl: 'https://zaping.example/reset-password?token=secret-token',
        expiresAt: new Date('2026-09-01T17:00:00.000Z'),
      }),
    ).rejects.toBe(providerError);
  });

  it('maps Resend error responses to internal delivery failures', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: {
        name: 'validation_error',
        message: 'Domain is not verified',
      },
    });
    const service = new EmailService();

    await expect(
      service.sendPasswordResetEmail({
        to: 'ada@example.com',
        resetUrl: 'https://zaping.example/reset-password?token=secret-token',
        expiresAt: new Date('2026-09-01T17:00:00.000Z'),
      }),
    ).rejects.toThrow('Resend password reset email delivery failed');
  });
});
