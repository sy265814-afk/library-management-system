const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(String(password), salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt-v1$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt-v1') return false;

  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expectedKey = Buffer.from(parts[2], 'hex');
    if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false;

    const actualKey = await scrypt(String(password), salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return crypto.timingSafeEqual(actualKey, expectedKey);
  } catch (error) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
