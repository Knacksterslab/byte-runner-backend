import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Node 20 has no native WebSocket and realtime-js requires an explicit
// transport there. We never open realtime channels, but the client is
// initialised eagerly — providing `ws` keeps boot working on any Node.
import ws from 'ws';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('supabase.url');
    const serviceRoleKey = this.configService.get<string>('supabase.serviceRoleKey');

    if (!url || !serviceRoleKey) {
      throw new Error('Supabase configuration is missing.');
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      // ws's typings don't match realtime-js's WebSocketLikeConstructor (known gap)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
