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
  status: 'pending' | 'sending' | 'sent' | 'failed';
  timestamp: Date;
  error?: string;
  retryCount?: number;
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

    if (!plaintext.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const tempId = this.generateTempId();
    const pendingMessage: PendingMessage = {
      id: tempId,
      content: plaintext,
      senderId: currentUser.uuid,
      status: 'pending',
      timestamp: new Date(),
      retryCount: 0
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
      // Update status to sending
      this.updatePendingMessageStatus(tempId, 'sending');

      const privateKey = await this.identity.getPrivateKey();
      if (!privateKey) {
        throw new Error('No local identity available');
      }

      const recipientKey = await this.fetchPublicKey(recipientId);
      if (!recipientKey) {
        throw new Error('Recipient encryption key not available');
      }

      const aesKey = await this.encryption.deriveSharedKey(
        privateKey,
        recipientKey
      );

      const encrypted = await this.encryption.encryptMessage(aesKey, plaintext);

      await this.sendToBackend(recipientId, encrypted, tempId);
      
      // Update status to sent on successful backend response
      this.updatePendingMessageStatus(tempId, 'sent');
    } catch (err: any) {
      console.error('[MESSAGING] Message processing failed:', err);
      
      // Update status to failed with error message
      const errorMessage = this.getErrorMessage(err);
      this.updatePendingMessageStatus(tempId, 'failed', errorMessage);
      
      throw err;
    }
  }

  private getErrorMessage(error: any): string {
    if (error?.status === 422) {
      return 'Message validation failed';
    } else if (error?.status === 404) {
      return 'Recipient not found';
    } else if (error?.status === 500) {
      return 'Server error occurred';
    } else if (error?.message) {
      return error.message;
    } else {
      return 'Failed to send message';
    }
  }

  private updatePendingMessageStatus(tempId: string, status: PendingMessage['status'], error?: string): void {
    // This will be used by the component to update the UI
    // The component will need to track pending messages and update their status
    console.log('[MESSAGING] Updating message status:', { tempId, status, error });
  }

  private async fetchPublicKey(userId: string): Promise<JsonWebKey> {
    console.log('[MESSAGING] Fetching public key for user:', userId);
    try {
      const response = await firstValueFrom(
        this.api.get<{ data: { public_key: JsonWebKey } }>(`keys/${userId}`)
      );
      console.log('[MESSAGING] Successfully fetched public key for:', userId);
      
      // Validate the public key structure
      if (!response.data?.public_key) {
        throw new Error('Invalid public key response from server');
      }
      
      return response.data.public_key;
    } catch (error: any) {
      console.error('[MESSAGING] Failed to fetch public key for user:', userId, error);
      
      if (error?.status === 404) {
        throw new Error(`User ${userId} not found or has no encryption key`);
      } else if (error?.status === 500) {
        throw new Error('Server error while fetching encryption key');
      } else {
        throw new Error('Failed to fetch encryption key');
      }
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
      ) as any;
      console.log('[MESSAGING] Backend response:', response);
      
      // Validate response
      if (!response?.data?.id) {
        throw new Error('Invalid response from server');
      }
      
    } catch (error: any) {
      console.error('[MESSAGING] Backend error:', error);
      console.error('[MESSAGING] Error status:', error?.status);
      console.error('[MESSAGING] Error details:', error?.error);
      
      // Provide better error messages
      if (error?.status === 422) {
        throw new Error('Message validation failed');
      } else if (error?.status === 404) {
        throw new Error('Recipient not found');
      } else if (error?.status === 500) {
        throw new Error('Server error occurred while sending message');
      } else if (error?.status === 429) {
        throw new Error('Too many messages sent, please try again later');
      } else {
        throw new Error('Failed to send message');
      }
    }
  }

  private generateTempId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async fetchMessages(
    userId: string,
    page: number = 1,
    perPage: number = 50,
    retryCount: number = 0
  ): Promise<PaginatedMessages> {
    try {
      console.log('[MESSAGING] Fetching messages:', { userId, page, perPage });
      
      const response = await firstValueFrom(
        this.api.get<{
          data: StoredMessage[];
          pagination: PaginatedMessages['pagination'];
        }>(`messages/${userId}?page=${page}&per_page=${perPage}`)
      );

      console.log('[MESSAGING] Successfully fetched messages:', {
        userId,
        messageCount: response.data?.length || 0,
        currentPage: response.pagination?.current_page
      });

      return {
        messages: response.data || [],
        pagination: response.pagination || {
          current_page: 1,
          last_page: 1,
          per_page: perPage,
          total: 0
        },
      };
    } catch (error: any) {
      console.error('[MESSAGING] Error fetching messages:', error);
      
      // Retry logic for network errors
      if (retryCount < 2 && (error?.status === 0 || error?.status >= 500)) {
        console.log(`[MESSAGING] Retrying fetch messages (attempt ${retryCount + 1}/3)`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.fetchMessages(userId, page, perPage, retryCount + 1);
      }
      
      throw new Error('Failed to fetch messages');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async decryptMessage(storedMessage: StoredMessage): Promise<string> {
    try {
      const privateKey = await this.identity.getPrivateKey();
      if (!privateKey) {
        throw new Error('No local identity available');
      }

      // For incoming messages, use sender's public key
      // For outgoing messages, use recipient's public key
      const keyUserId = storedMessage.is_outgoing ? storedMessage.recipient_id : storedMessage.sender_id;
      
      // Use cached public key to avoid repeated API calls
      const otherUserKey = await this.getCachedPublicKey(keyUserId);

      const aesKey = await this.encryption.deriveSharedKey(
        privateKey,
        otherUserKey
      );

      const encrypted: EncryptedMessage = {
        ciphertext: storedMessage.ciphertext,
        iv: storedMessage.iv,
      };

      const decrypted = await this.encryption.decryptMessage(aesKey, encrypted);
      
      // Validate decrypted content
      if (!decrypted || typeof decrypted !== 'string') {
        throw new Error('Invalid decrypted content');
      }
      
      return decrypted;
    } catch (decryptError: any) {
      console.error('[MESSAGING] Decryption failed:', {
        messageId: storedMessage.id,
        error: decryptError,
        isOutgoing: storedMessage.is_outgoing
      });
      
      // Provide better error messages
      if (decryptError?.name === 'OperationError') {
        throw new Error('Unable to decrypt message - encryption key mismatch');
      } else if (decryptError?.message?.includes('IV')) {
        throw new Error('Unable to decrypt message - invalid encryption data');
      } else {
        throw new Error('Unable to decrypt message');
      }
    }
  }

  private publicKeyCache = new Map<string, JsonWebKey>();

  private async getCachedPublicKey(userId: string): Promise<JsonWebKey> {
    // Check cache first
    if (this.publicKeyCache.has(userId)) {
      console.log('[MESSAGING] Using cached public key for user:', userId);
      return this.publicKeyCache.get(userId)!;
    }

    // Fetch from API if not in cache
    console.log('[MESSAGING] Fetching and caching public key for user:', userId);
    const response = await firstValueFrom(
      this.api.get<{ data: { public_key: JsonWebKey } }>(`keys/${userId}`)
    );
    
    const publicKey = response.data.public_key;
    this.publicKeyCache.set(userId, publicKey);
    console.log('[MESSAGING] Cached public key for user:', userId);
    
    return publicKey;
  }

  async preFetchPublicKey(userId: string): Promise<void> {
    // This method just ensures the key is cached
    await this.getCachedPublicKey(userId);
  }

  async fetchConversations(retryCount: number = 0): Promise<ApiConversation[]> {
    console.log('[MESSAGING] fetchConversations started');
    try {
      const response = await firstValueFrom(
        this.api.get<{ data: ApiConversation[] }>('messages')
      );
      console.log('[MESSAGING] Successfully fetched conversations:', {
        count: response.data?.length || 0
      });
      
      // Validate response data
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid conversations response from server');
      }
      
      return response.data;
    } catch (err: any) {
      console.error('[MESSAGING] Error fetching conversations:', err);
      console.error('[MESSAGING] Error status:', err?.status);
      console.error('[MESSAGING] Error details:', err?.error);
      
      // Retry logic for network errors
      if (retryCount < 2 && (err?.status === 0 || err?.status >= 500)) {
        console.log(`[MESSAGING] Retrying fetch conversations (attempt ${retryCount + 1}/3)`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.fetchConversations(retryCount + 1);
      }
      
      // Return empty array to prevent UI from breaking
      console.warn('[MESSAGING] Returning empty conversations array due to error');
      return [];
    }
  }
}
