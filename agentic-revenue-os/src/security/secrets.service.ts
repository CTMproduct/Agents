import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Cifrado AES-256-GCM para el vault de secretos por tenant.
 * La clave se deriva de ENCRYPTION_KEY (env). Formato almacenado (hex):
 * iv(12 bytes) | authTag(16 bytes) | ciphertext.
 * Los valores son write-only: se cifran al guardar y solo se descifran
 * internamente cuando un conector los necesite -- jamas via API.
 */
@Injectable()
export class SecretsService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const raw = this.config.get<string>('ENCRYPTION_KEY');
    if (!raw) throw new Error('Falta ENCRYPTION_KEY en .env');
    return createHash('sha256').update(raw).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('hex');
  }

  decrypt(stored: string): string {
    const buf = Buffer.from(stored, 'hex');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
