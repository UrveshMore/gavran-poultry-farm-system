import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

function key(): Buffer {
  return createHash('sha256').update(env.JWT_SECRET).digest();
}

export function encryptSecret(plain: string): { cipherText: string; nonce: string; authTag: string; hint: string } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), nonce);
  const cipherText = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    cipherText: cipherText.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    hint: plain.slice(-4),
  };
}

export function decryptSecret(cipherText: string, nonce: string, authTag: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64')), decipher.final()]).toString('utf8');
}
