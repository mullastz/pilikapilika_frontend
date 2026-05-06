import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdentityService } from './crypto/identity.service';
import { EncryptionService, type EncryptedMessage } from './crypto/encryption.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface PendingMessage {
  id: string;
  content: string;
  senderId: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: Date;
}

export interface SendResult {
  pendingMessage: PendingMessage;
  promise: Promise<void>;
}

export interface StoredMessage {
  id: number;
  sender_id: string;
  recipient_id: string;
  ciphertext: string;
  iv: string;
  is_outgoing: boolean;
  read_at: string | null;
  created_at: string;
}

export interface PaginatedMessages {
  messages: StoredMessage[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ApiConversation {
  user_id: string;
  name: string;
  avatar: string;
  last_message_at: string | null;
  unread_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class MessagingService {
  constructor(
    private identity: IdentityService,
    private encryption: EncryptionService,
    private api: ApiService,
    private auth: AuthService
  ) {}

  sendMessage(recipientId: string, plaintext: string): SendResult {
    const currentUser = this.auth.getUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const tempId = this.generateTempId();
    const pendingMessage: PendingMessage = {
      id: tempId,
      content: plaintext,
      senderId: currentUser.uuid,
      status: 'pending',
      timestamp: new Date()
    };

    const promise = this.processMessage(tempId, recipientId, plaintext);

    return {
      pendingMessage,
      promise
    };
  }

  private async processMessage(
    tempId: string,
    recipientId: string,
    plaintext: string
  ): Promise<void> {
    try {
      const privateKey = await this.identity.getPrivateKey();
      if (!privateKey) {
        throw new Error('No local identity');
      }

      const recipientKey = await this.fetchPublicKey(recipientId);

      const aesKey = await this.encryption.deriveSharedKey(
        privateKey,
        recipientKey
      );

      const encrypted = await this.encryption.encryptMessage(aesKey, plaintext);

      await this.sendToBackend(recipientId, encrypted, tempId);
    } catch (err) {
      throw err;
    }
  }

  private async fetchPublicKey(userId: string): Promise<JsonWebKey> {
    console.log('[MESSAGING] Fetching public key for user:', userId);
    try {
      const response = await firstValueFrom(
        this.api.get<{ data: { public_key: JsonWebKey } }>(`keys/${userId}`)
      );
      console.log('[MESSAGING] Successfully fetched public key for:', userId);
      return response.data.public_key;
    } catch (error) {
      console.error('[MESSAGING] Failed to fetch public key for user:', userId, error);
      throw error;
    }
  }

  private async sendToBackend(
    recipientId: string,
    encrypted: EncryptedMessage,
    tempId: string
  ): Promise<void> {
    console.log('[MESSAGING] Sending to backend:', {
      recipient_id: recipientId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      temp_id: tempId
    });
    
    try {
      const response = await firstValueFrom(
        this.api.post('messages', {
          recipient_id: recipientId,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          temp_id: tempId
        })
      );
      console.log('[MESSAGING] Backend response:', response);
    } catch (error: any) {
      console.error('[MESSAGING] Backend error:', error);
      console.error('[MESSAGING] Error status:', error?.status);
      console.error('[MESSAGING] Error details:', error?.error);
      throw error;
    }
  }

  private generateTempId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async fetchMessages(
    userId: string,
    page: number = 1,
    perPage: number = 50
  ): Promise<PaginatedMessages> {
    const response = await firstValueFrom(
      this.api.get<{
        data: StoredMessage[];
        pagination: PaginatedMessages['pagination'];
      }>(`messages/${userId}?page=${page}&per_page=${perPage}`)
    );

    return {
      messages: response.data,
      pagination: response.pagination,
    };
  }

  async decryptMessage(storedMessage: StoredMessage): Promise<string> {
    const privateKey = await this.identity.getPrivateKey();
    if (!privateKey) {
      throw new Error('No local identity');
    }

    console.log('[MESSAGING] Decrypting message from:', storedMessage.sender_id);
    console.log('[MESSAGING] Message recipient:', storedMessage.recipient_id);
    
    // For incoming messages, use sender's public key
    // For outgoing messages, use recipient's public key
    const keyUserId = storedMessage.is_outgoing ? storedMessage.recipient_id : storedMessage.sender_id;
    const otherUserKey = await this.fetchPublicKey(keyUserId);

    console.log('[MESSAGING] Using key from user:', keyUserId);

    const aesKey = await this.encryption.deriveSharedKey(
      privateKey,
      otherUserKey
    );

    const encrypted: EncryptedMessage = {
      ciphertext: storedMessage.ciphertext,
      iv: storedMessage.iv,
    };

    try {
      const decrypted = await this.encryption.decryptMessage(aesKey, encrypted);
      console.log('[MESSAGING] Successfully decrypted message');
      return decrypted;
    } catch (decryptError) {
      console.error('[MESSAGING] Decryption failed:', decryptError);
      throw decryptError;
    }
  }

  async fetchConversations(): Promise<ApiConversation[]> {
    console.log('[MESSAGING] fetchConversations started');
    try {
      const response = await firstValueFrom(
        this.api.get<{ data: ApiConversation[] }>('messages')
      );
      console.log('[MESSAGING] API response received:', response);
      return response.data;
    } catch (err: any) {
      console.error('[MESSAGING] Error fetching conversations:', err);
      console.error('[MESSAGING] Error status:', err?.status);
      console.error('[MESSAGING] Error details:', err?.error);
      
      // Return empty array to prevent UI from breaking
      return [];
    }
  }
}
