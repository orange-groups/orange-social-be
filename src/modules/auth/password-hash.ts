import * as bcrypt from 'bcrypt';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_FORMAT = /^scrypt-v1:([a-f0-9]{32}):([a-f0-9]{64})$/;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt-v1:${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const match = SCRYPT_FORMAT.exec(storedHash);
  if (match) {
    const [, salt, key] = match;
    const candidate = await derivePasswordKey(
      password,
      Buffer.from(salt, 'hex'),
    );
    return timingSafeEqual(candidate, Buffer.from(key, 'hex'));
  }
  if (storedHash.startsWith('$2')) {
    // Preserve login for accounts created before the password-hash change.
    return bcrypt.compare(password, storedHash).catch(() => false);
  }
  return false;
}
