import { describe, expect, it } from 'vitest';
import { verifyCredentials } from './auth';

describe('auth', () => {
  it('authenticates valid credentials', async () => {
    const session = await verifyCredentials('coach', 'CoachSecure1!');
    expect(session).not.toBeNull();
    expect(session?.username).toBe('coach');
    expect(session?.token).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    const session = await verifyCredentials('coach', 'WrongPassword');
    expect(session).toBeNull();
  });
});
