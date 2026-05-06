import { Injectable } from '@angular/core';

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
}

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  async deriveSharedKey(
    localPrivateKey: CryptoKey,
    remotePublicKeyJwk: JsonWebKey
  ): Promise<CryptoKey> {
    const remotePublicKey = await crypto.subtle.importKey(
      'jwk',
      remotePublicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: remotePublicKey
      },
      localPrivateKey,
      256
    );

    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode('pilika-message-key'),
        hash: 'SHA-256'
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptMessage(
    aesKey: CryptoKey,
    plaintext: string
  ): Promise<EncryptedMessage> {
    // Generate 16 bytes to ensure 24-character Base64 when encoded
    const iv = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array;
    const encoded = new TextEncoder().encode(plaintext);

    const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      aesKey,
      encoded
    );

    // Use the same IV for both encryption and storage
    const ivBase64 = btoa(String.fromCharCode(...iv));
    
    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: ivBase64
    };
  }

  async decryptMessage(
    aesKey: CryptoKey,
    encrypted: EncryptedMessage
  ): Promise<string> {
    console.log('[ENCRYPTION] Decrypting message...');
    console.log('[ENCRYPTION] Ciphertext length:', encrypted.ciphertext.length);
    console.log('[ENCRYPTION] IV length:', encrypted.iv.length);
    
    const ciphertext = this.base64ToArrayBuffer(encrypted.ciphertext);
    const ivBuffer = this.base64ToArrayBuffer(encrypted.iv);
    const iv = new Uint8Array(ivBuffer);
    
    console.log('[ENCRYPTION] Ciphertext ArrayBuffer length:', ciphertext.byteLength);
    console.log('[ENCRYPTION] IV ArrayBuffer length:', iv.length);

    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        aesKey,
        ciphertext
      );
      
      console.log('[ENCRYPTION] Decryption successful');
      return new TextDecoder().decode(decrypted);
    } catch (decryptError) {
      console.error('[ENCRYPTION] Decryption failed:', decryptError);
      console.error('[ENCRYPTION] Ciphertext:', encrypted.ciphertext.substring(0, 50) + '...');
      console.error('[ENCRYPTION] IV:', encrypted.iv);
      throw decryptError;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
