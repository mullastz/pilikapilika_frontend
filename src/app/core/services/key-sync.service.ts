import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdentityService } from './crypto/identity.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export type SyncStatus = 'ready' | 'generating' | 'syncing' | 'error';

export interface KeySyncState {
  status: SyncStatus;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class KeySyncService {
  readonly state = signal<KeySyncState>({ status: 'generating' });

  constructor(
    private identity: IdentityService,
    private api: ApiService,
    private auth: AuthService
  ) {}

  async initialize(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.state.set({ status: 'ready' });
      return;
    }

    try {
      this.state.set({ status: 'generating' });

      const hasIdentity = await this.identity.hasIdentity();
      if (!hasIdentity) {
        await this.identity.generateIdentity();
      }

      this.state.set({ status: 'syncing' });
      await this.syncKeyWithServer();

      this.state.set({ status: 'ready' });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Key sync failed';
      this.state.set({ status: 'error', error });
    }
  }

  async syncKeyWithServer(): Promise<void> {
    const user = this.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    const publicKeyJwk = await this.identity.getPublicKeyJwk();
    if (!publicKeyJwk) {
      throw new Error('No local identity found');
    }

    const storedKey = await this.fetchServerKey(user.uuid);
    const localKeyFingerprint = this.getKeyFingerprint(publicKeyJwk);

    if (storedKey) {
      const serverKeyFingerprint = this.getKeyFingerprint(storedKey);
      if (localKeyFingerprint === serverKeyFingerprint) {
        return;
      }
    }

    await this.uploadKey(publicKeyJwk);
  }

  private async fetchServerKey(userId: string): Promise<JsonWebKey | null> {
    try {
      const response = await firstValueFrom(
        this.api.get<{ data: { public_key: JsonWebKey } }>(`keys/${userId}`)
      );
      return response.data?.public_key ?? null;
    } catch (err) {
      const error = err as { status?: number };
      if (error.status === 404) {
        return null;
      }
      throw err;
    }
  }

  private async uploadKey(publicKeyJwk: JsonWebKey): Promise<void> {
    await firstValueFrom(
      this.api.post('keys', { public_key: JSON.stringify(publicKeyJwk) })
    );
  }

  private getKeyFingerprint(jwk: JsonWebKey): string {
    const material = `${jwk.x}:${jwk.y}`;
    let hash = 0;
    for (let i = 0; i < material.length; i++) {
      const char = material.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
