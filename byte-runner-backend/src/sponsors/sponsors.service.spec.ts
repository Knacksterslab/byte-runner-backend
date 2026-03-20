import { sign } from 'jsonwebtoken';
import { SponsorsService } from './sponsors.service';

describe('SponsorsService', () => {
  const secret = 'test-secret';
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'sponsors.trackingTokenSecret') return secret;
      if (key === 'sponsors.trackingTokenTtlSeconds') return 3600;
      if (key === 'runs.runTokenSecret') return secret;
      return undefined;
    }),
  };

  const makeService = (insertResult?: { error?: any }) => {
    const client = {
      from: jest.fn(() => ({
        insert: jest.fn(async () => insertResult ?? { error: null }),
      })),
    };
    const supabaseService = { getClient: () => client };
    return {
      service: new SponsorsService(supabaseService as any, configService as any),
      client,
    };
  };

  it('decodes a valid tracking token', () => {
    const { service } = makeService();
    const token = sign(
      {
        sponsorId: 'sponsor-1',
        campaignId: 'campaign-1',
        creativeId: 'creative-1',
        ctaUrl: 'https://example.com/offer',
      },
      secret,
      { algorithm: 'HS256', expiresIn: 3600 },
    );

    const decoded = service.decodeTrackingToken(token);
    expect(decoded.campaignId).toBe('campaign-1');
    expect(decoded.creativeId).toBe('creative-1');
    expect(decoded.ctaUrl).toBe('https://example.com/offer');
  });

  it('returns duplicated=true when idempotency key collides', async () => {
    const { service } = makeService({ error: { code: '23505', message: 'duplicate key value' } });
    const token = sign(
      {
        sponsorId: 'sponsor-1',
        campaignId: 'campaign-1',
        creativeId: 'creative-1',
        ctaUrl: 'https://example.com/offer',
      },
      secret,
      { algorithm: 'HS256', expiresIn: 3600 },
    );

    const result = await service.recordAdEvent({
      trackingToken: token,
      eventType: 'impression',
      idempotencyKey: 'imp-123',
    });
    expect(result.recorded).toBe(false);
    expect(result.duplicated).toBe(true);
    expect(result.ctaUrl).toBe('https://example.com/offer');
  });
});
