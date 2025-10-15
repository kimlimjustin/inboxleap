import crypto from 'crypto';

/**
 * EncryptionService - Secure encryption for sensitive data like email passwords
 * Uses AES-256-GCM for authenticated encryption
 */
class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16;  // 128 bits
  private tagLength = 16; // 128 bits
  private saltLength = 32; // 256 bits
  private iterations = 100000; // PBKDF2 iterations
  
  private masterKey: Buffer;

  constructor() {
    // Get encryption key from environment or generate one
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
    
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY or SESSION_SECRET must be set in environment variables');
    }
    
    // Derive a proper key from the provided secret using PBKDF2
    const salt = crypto.createHash('sha256').update('email-password-encryption').digest();
    this.masterKey = crypto.pbkdf2Sync(encryptionKey, salt, this.iterations, this.keyLength, 'sha256');
  }

  /**
   * Encrypt a password or sensitive string
   * @param plaintext The plain text password to encrypt
   * @returns Base64 encoded encrypted data with format: salt:iv:authTag:encrypted
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random salt and IV for this encryption
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive encryption key from master key and salt
      const key = crypto.pbkdf2Sync(this.masterKey, salt, 1000, this.keyLength, 'sha256');
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
      
      // Encrypt the data
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine salt, iv, authTag, and encrypted data
      const combined = Buffer.concat([salt, iv, authTag, encrypted]);
      
      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a password or sensitive string
   * @param encryptedData Base64 encoded encrypted data
   * @returns The decrypted plain text
   */
  decrypt(encryptedData: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = combined.slice(0, this.saltLength);
      const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
      const authTag = combined.slice(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);
      
      // Derive decryption key from master key and salt
      const key = crypto.pbkdf2Sync(this.masterKey, salt, 1000, this.keyLength, 'sha256');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a string is encrypted (base64 encoded with our format)
   */
  isEncrypted(data: string): boolean {
    try {
      // Check if it's valid base64
      const decoded = Buffer.from(data, 'base64');
      // Check if it has the minimum length for our format (salt + iv + tag + at least 0 bytes of data)
      return decoded.length >= (this.saltLength + this.ivLength + this.tagLength);
    } catch {
      return false;
    }
  }

  /**
   * Migrate an unencrypted password to encrypted format
   * Safe to call on already encrypted data (will return as-is)
   */
  migratePassword(password: string): string {
    if (this.isEncrypted(password)) {
      return password; // Already encrypted
    }
    return this.encrypt(password);
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();