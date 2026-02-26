import { Injectable } from '@nestjs/common';

export interface RecoverySponsor {
  id: string;
  tag?: string;
  logo?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaUrl?: string;
  threatIds?: string[];
  kitTypes?: string[];
}

const RECOVERY_SPONSORS: RecoverySponsor[] = [
  {
    id: 'password-fortress',
    tag: 'SPONSORED',
    logo: 'PM',
    title: 'Password Fortress',
    description: 'Secure every account with one-click vault + breach alerts',
    ctaLabel: 'TRY FREE',
    ctaUrl: 'https://example.com/password-fortress',
    kitTypes: ['password-manager'],
    threatIds: ['credential-stuffing', 'brute-force'],
  },
  {
    id: 'guardian-vpn',
    tag: 'SPONSORED',
    logo: 'VPN',
    title: 'Guardian VPN',
    description: 'Encrypt traffic and block unsafe public Wi-Fi hotspots',
    ctaLabel: 'LEARN MORE',
    ctaUrl: 'https://example.com/guardian-vpn',
    kitTypes: ['vpn-shield'],
  },
];

@Injectable()
export class SponsorsService {
  getRecoverySponsor(threatId?: string, kitType?: string): Omit<RecoverySponsor, 'threatIds' | 'kitTypes'> | null {
    const enabled = process.env.RECOVERY_SPONSORING_ENABLED !== 'false';
    if (!enabled) return null;

    const threat = threatId?.trim().toLowerCase();
    const kit = kitType?.trim().toLowerCase();

    const score = (sponsor: RecoverySponsor): number => {
      let rank = 0;
      if (kit && sponsor.kitTypes?.includes(kit)) rank += 2;
      if (threat && sponsor.threatIds?.includes(threat)) rank += 1;
      return rank;
    };

    const best = RECOVERY_SPONSORS
      .map((sponsor) => ({ sponsor, rank: score(sponsor) }))
      .sort((a, b) => b.rank - a.rank)[0];

    if (!best || best.rank <= 0) return null;
    const { threatIds, kitTypes, ...publicSponsor } = best.sponsor;
    return publicSponsor;
  }
}
