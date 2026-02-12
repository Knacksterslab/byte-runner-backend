import { BadRequestException, Injectable } from '@nestjs/common';
import SuperTokens from 'supertokens-node';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserRecord {
  id: string;
  supertokens_id: string;
  email: string | null;
  username: string | null;
  continue_tokens: number;
  featured_badge: string | null;
  created_at: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private async getEmailForUser(supertokensId: string): Promise<string | null> {
    try {
      const user = await SuperTokens.getUser(supertokensId);
      const email = user?.emails?.[0];
      return email || null;
    } catch {
      return null;
    }
  }

  async getOrCreateUser(supertokensId: string): Promise<UserRecord> {
    const email = await this.getEmailForUser(supertokensId);
    const { data: existing, error } = await this.client
      .from('users')
      .select('*')
      .eq('supertokens_id', supertokensId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException(error.message || 'Failed to fetch user.');
    }

    if (existing) {
      if (email && existing.email !== email) {
        const { data: updated, error: updateError } = await this.client
          .from('users')
          .update({ email })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (updateError || !updated) {
          throw new BadRequestException(updateError?.message || 'Failed to update user email.');
        }

        return updated as UserRecord;
      }
      return existing as UserRecord;
    }

    const { data: created, error: insertError } = await this.client
      .from('users')
      .insert({ supertokens_id: supertokensId, email })
      .select('*')
      .single();

    if (insertError || !created) {
      throw new BadRequestException(insertError?.message || 'Failed to create user.');
    }

    return created as UserRecord;
  }

  async setUsername(supertokensId: string, username: string): Promise<UserRecord> {
    const normalized = username.trim();
    if (!normalized) {
      throw new BadRequestException('Username is required.');
    }

    const { data: taken } = await this.client
      .from('users')
      .select('id')
      .ilike('username', normalized)
      .limit(1);

    if (taken && taken.length > 0) {
      throw new BadRequestException('Username is already taken.');
    }

    const user = await this.getOrCreateUser(supertokensId);

    const { data: updated, error } = await this.client
      .from('users')
      .update({ username: normalized })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new BadRequestException('Failed to update username.');
    }

    return updated as UserRecord;
  }
}
