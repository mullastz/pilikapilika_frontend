import { Injectable } from '@angular/core';

interface StoredKeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class IdentityService {
  private readonly DB_NAME = 'pilika_crypto';
  private readonly STORE_NAME = 'identity_keys';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    if (!this.db) {
      await this.initDatabase();
    }
    const transaction = this.db!.transaction([this.STORE_NAME], mode);
    return transaction.objectStore(this.STORE_NAME);
  }

  async generateIdentity(): Promise<void> {
    // Check if Web Crypto is available (requires HTTPS or localhost)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error(
        'Web Crypto API requires a secure context (HTTPS or localhost). ' +
        'Please access the application via https:// or localhost instead of an IP address. ' +
        'For local development, use: ng serve --host localhost'
      );
    }

    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveBits']
    );

    const [publicKeyJwk, privateKeyJwk] = await Promise.all([
      crypto.subtle.exportKey('jwk', keyPair.publicKey),
      crypto.subtle.exportKey('jwk', keyPair.privateKey)
    ]);

    const storedData: StoredKeyPair & { id: string } = {
      id: 'identity',
      publicKey: publicKeyJwk,
      privateKey: privateKeyJwk,
      createdAt: Date.now()
    };

    const store = await this.getStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(storedData);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async hasIdentity(): Promise<boolean> {
    const store = await this.getStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.get('identity');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(!!request.result);
    });
  }

  async getPublicKey(): Promise<CryptoKey | null> {
    const stored = await this.getStoredKeyPair();
    if (!stored) return null;

    return crypto.subtle.importKey(
      'jwk',
      stored.publicKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
  }

  async getPublicKeyJwk(): Promise<JsonWebKey | null> {
    const stored = await this.getStoredKeyPair();
    return stored?.publicKey ?? null;
  }

  async getPrivateKey(): Promise<CryptoKey | null> {
    const stored = await this.getStoredKeyPair();
    if (!stored) return null;

    return crypto.subtle.importKey(
      'jwk',
      stored.privateKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
  }

  private async getStoredKeyPair(): Promise<StoredKeyPair | null> {
    const store = await this.getStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.get('identity');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as (StoredKeyPair & { id: string }) | undefined;
        resolve(result ? { publicKey: result.publicKey, privateKey: result.privateKey, createdAt: result.createdAt } : null);
      };
    });
  }
}
