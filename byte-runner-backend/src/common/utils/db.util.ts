import { BadRequestException } from '@nestjs/common';

/** Throws BadRequestException if a Supabase error is present. */
export function assertNoDbError(error: any, message?: string): void {
  if (error) throw new BadRequestException(message ?? error.message ?? 'Database error');
}

/**
 * Throws BadRequestException if error is present and it is NOT a "row not found" (PGRST116).
 * Use when a missing row is expected and handled by returning null.
 */
export function assertNoDbErrorExceptNotFound(error: any, message?: string): void {
  if (error && error.code !== 'PGRST116') {
    throw new BadRequestException(message ?? error.message ?? 'Database error');
  }
}
