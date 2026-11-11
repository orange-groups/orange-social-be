import { NotImplementedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MailModule } from './mail.module';
import { MailService } from './mail.service';

describe('Mail skeleton', () => {
  it('wires the provider without sending mail', async () => {
    const module = await Test.createTestingModule({
      imports: [MailModule],
    }).compile();
    try {
      const service = module.get(MailService);
      expect(() =>
        service.sendPasswordReset({
          to: 'test@example.com',
          resetUrl: 'https://example.com/reset-password',
          requestId: 'test-request',
        }),
      ).toThrow(NotImplementedException);
    } finally {
      await module.close();
    }
  });
});
