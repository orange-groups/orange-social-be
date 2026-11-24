import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const KEY = 're_test';
const FROM = 'Orange Social <noreply@example.test>';
const INPUT = {
  to: 'test@example.test',
  resetUrl: 'https://frontend.example.test/reset-password?token=example',
  requestId: 'test-request-id',
};

function createService(apiKey = KEY) {
  return new MailService(
    new ConfigService({ RESEND_API_KEY: apiKey, MAIL_FROM: FROM }),
  );
}

describe('Resend mail adapter', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends plain text with a bounded request and stable idempotency key', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'message-1' }));
    await expect(createService().sendPasswordReset(INPUT)).resolves.toEqual({
      providerMessageId: 'message-1',
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request?.method).toBe('POST');
    expect(request?.redirect).toBe('error');
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    expect(request?.headers).toEqual({
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'password-reset/test-request-id',
    });
    if (typeof request?.body !== 'string')
      throw new Error('Missing email body');
    const body: unknown = JSON.parse(request.body);
    expect(body).toMatchObject({ from: FROM, to: INPUT.to });
    expect(request.body).toContain(INPUT.resetUrl);
  });

  it('fails gracefully without making a request when configuration is absent', async () => {
    const service = createService('');
    expect(() => service.assertConfigured()).toThrow(
      ServiceUnavailableException,
    );
    await expect(service.sendPasswordReset(INPUT)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 429, 500])(
    'handles HTTP %s without surfacing provider data',
    async (status) => {
      fetchMock.mockResolvedValue(
        Response.json({ message: 'private provider error' }, { status }),
      );
      await expect(createService().sendPasswordReset(INPUT)).rejects.toThrow(
        'Không gửi được email.',
      );
    },
  );

  it('handles timeouts and malformed success responses', async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException('Timeout', 'TimeoutError'),
    );
    fetchMock.mockResolvedValueOnce(Response.json({ id: null }));
    const service = createService();
    await expect(service.sendPasswordReset(INPUT)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.sendPasswordReset(INPUT)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
