/**
 * SECURITY: Credentials Encryption Service
 * 
 * This service provides client-side encryption for sensitive storage credentials
 * before they are stored in the database.
 * 
 * IMPORTANT: This is a basic implementation. For production use with highly
 * sensitive data, consider using:
 * - Supabase Vault for secret management
 * - Server-side encryption with proper key management
 * - Hardware Security Modules (HSM) for key storage
 */

import { logger } from '@/services/logger';

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}

class CredentialsEncryptionService {
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly SALT_LENGTH = 16;
  private readonly IV_LENGTH = 12;

  /**
   * Derives an encryption key from a password using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts sensitive data
   * @param data - The data to encrypt
   * @param password - Encryption password (should be user-specific and secure)
   * @returns Encrypted data with IV and salt
   */
  async encrypt(data: string, password: string): Promise<EncryptedData> {
    try {
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive encryption key
      const key = await this.deriveKey(password, salt);

      // Encrypt data
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        dataBuffer
      );

      // Convert to base64 for storage
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const encrypted = this.arrayBufferToBase64(encryptedArray);
      const ivBase64 = this.arrayBufferToBase64(iv);
      const saltBase64 = this.arrayBufferToBase64(salt);

      logger.debug('Data encrypted successfully');

      return {
        encrypted,
        iv: ivBase64,
        salt: saltBase64
      };
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts encrypted data
   * @param encryptedData - The encrypted data object
   * @param password - Decryption password
   * @returns Decrypted data as string
   */
  async decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
    try {
      // Convert base64 back to Uint8Array
      const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const salt = this.base64ToArrayBuffer(encryptedData.salt);

      // Derive decryption key
      const key = await this.deriveKey(password, salt);

      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv.buffer as ArrayBuffer },
        key,
        encrypted.buffer as ArrayBuffer
      );

      const decoder = new TextDecoder();
      const decrypted = decoder.decode(decryptedBuffer);

      logger.debug('Data decrypted successfully');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data - invalid password or corrupted data');
    }
  }

  /**
   * Encrypts storage credentials for safe database storage
   */
  async encryptStorageCredentials(
    credentials: Record<string, any>,
    userPassword: string
  ): Promise<string> {
    const credentialsJson = JSON.stringify(credentials);
    const encrypted = await this.encrypt(credentialsJson, userPassword);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypts storage credentials from database
   */
  async decryptStorageCredentials(
    encryptedCredentials: string,
    userPassword: string
  ): Promise<Record<string, any>> {
    const encryptedData: EncryptedData = JSON.parse(encryptedCredentials);
    const decrypted = await this.decrypt(encryptedData, userPassword);
    return JSON.parse(decrypted);
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Generate a secure random password for encryption
   * This should be derived from user's session or authentication
   */
  generateEncryptionKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array);
  }
}

export const credentialsEncryption = new CredentialsEncryptionService();
