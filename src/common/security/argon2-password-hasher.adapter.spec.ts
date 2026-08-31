import { Argon2PasswordHasher } from './argon2-password-hasher.adapter';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('creates an Argon2id PHC hash and verifies only the correct password', async () => {
    const passwordHash = await hasher.hash('correct-password');

    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(passwordHash).toContain('m=19456,p=1,t=2');
    await expect(hasher.verify(passwordHash, 'correct-password')).resolves.toBe(true);
    await expect(hasher.verify(passwordHash, 'wrong-password')).resolves.toBe(false);
  });

  it('performs dummy verification for an unknown account without accepting it', async () => {
    await expect(hasher.verifyOrDummy(null, 'any-password')).resolves.toBe(false);
  });
});
