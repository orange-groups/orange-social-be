import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import { hashPassword, verifyPassword } from './password-hash';

describe('Password hashes', () => {
  it('keeps verifying existing bcrypt accounts', async () => {
    const legacy = await bcrypt.hash('legacy-password', 4);
    await expect(verifyPassword('legacy-password', legacy)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', legacy)).resolves.toBe(false);
  });

  it('verifies passwords reset by the former Argon2id implementation', async () => {
    const legacy = await argon2.hash('legacy-password');
    await expect(verifyPassword('legacy-password', legacy)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', legacy)).resolves.toBe(false);
    await expect(
      verifyPassword('legacy-password', '$argon2id$broken'),
    ).resolves.toBe(false);
  });

  it('does not truncate passwords that share their first 72 UTF-8 bytes', async () => {
    const prefix = 'ế'.repeat(24);
    const storedHash = await hashPassword(`${prefix}1!`);
    expect(storedHash).toMatch(/^scrypt-v1:/);
    await expect(verifyPassword(`${prefix}1!`, storedHash)).resolves.toBe(true);
    await expect(verifyPassword(`${prefix}2!`, storedHash)).resolves.toBe(
      false,
    );
  });
});
