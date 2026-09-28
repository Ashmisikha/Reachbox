import crypto from 'crypto';
import { googleConfig } from '../../config/google';
import { slackConfig } from '../../config/slack';

/**
 * Derives a consistent 32-byte encryption key for AES-256-GCM
 */
function getEncryptionKey(): Buffer {
  const secretSource =
    slackConfig.SLACK_TOKEN_ENCRYPTION_KEY ||
    googleConfig.SESSION_SECRET ||
    'reachinbox-default-slack-encryption-key-32b';
  return crypto.createHash('sha256').update(secretSource).digest();
}

/**
 * Encrypts a sensitive Slack access token using AES-256-GCM.
 * Format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptSlackToken(plainToken: string): string {
  if (!plainToken) {
    return '';
  }

  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted Slack token.
 * If the payload is unencrypted (e.g. legacy/mock token), returns it safely as-is.
 */
export function decryptSlackToken(payload: string): string {
  if (!payload) {
    return '';
  }

  if (!payload.startsWith('enc:v1:')) {
    return payload;
  }

  const parts = payload.split(':');
  if (parts.length !== 5) {
    throw new Error('Malformed encrypted Slack token format');
  }

  const [, , ivHex, authTagHex, cipherHex] = parts as [string, string, string, string, string];
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
