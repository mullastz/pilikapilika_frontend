import { Component, OnInit, OnDestroy, ViewChild, ElementRef, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location  } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessagingService, type PendingMessage, type ApiConversation, type StoredMessage } from '../../core/services/messaging.service';
import { RealtimeService, type DecryptedMessage } from '../../core/services/realtime.service';
import { IdentityService } from '../../core/services/crypto/identity.service';
import { SecurityService } from '../../core/services/crypto/security.service';
import { KeySyncService } from '../../core/services/key-sync.service';
import { Subscription } from 'rxjs';

interface Message {
  id: number | string;
  sender: 'agent' | 'customer';
  text: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received' | 'locked';
}

interface UiConversation {
  id: string;
  customerName: string;
  customerImage: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
  messages: Message[];
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class Messages implements OnInit, OnDestroy {
  activeConversationId: string | null = null;
  newMessage = '';
  showMobileChat = false;
  isLoadingConversations = false;
  isLoadingMessages = false;

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  private messaging = inject(MessagingService);
  private realtime = inject(RealtimeService);
  private identity = inject(IdentityService);
  private security = inject(SecurityService);
  private keySync = inject(KeySyncService);
  private cdr = inject(ChangeDetectorRef);

  private messageSubscription: Subscription | null = null;

  conversations: UiConversation[] = [];

  constructor(private route: ActivatedRoute, private location: Location) {
    effect(() => {
      const incoming = this.realtime.incomingMessage();
      if (incoming) {
        this.handleIncomingMessage(incoming);
      }
    });
  }

  goBack() {
    this.location.back();
  }

  get activeConversation(): UiConversation | undefined {
    return this.conversations.find((c) => c.id === this.activeConversationId);
  }

  selectConversation(id: string) {
    this.activeConversationId = id;
    this.showMobileChat = true;
    const conversation = this.conversations.find((c) => c.id === id);
    if (conversation) {
      conversation.unreadCount = 0;
      // Load messages for the selected conversation
      this.loadMessages(id);
      
      // Force UI update immediately
      this.cdr.detectChanges();
      console.log('[MESSAGES] Conversation selected and UI updated:', id);
    }
  }

  closeMobileChat() {
    this.showMobileChat = false;
  }

  async loadConversations(): Promise<void> {
    console.log('[MESSAGES] loadConversations started');
    this.isLoadingConversations = true;

    try {
      console.log('[MESSAGES] Calling fetchConversations API...');
      
      const apiConversations = await this.messaging.fetchConversations();
      
      console.log('[MESSAGES] API returned conversations:', apiConversations.length);
      this.conversations = (apiConversations as any[]).map((conv: any): UiConversation => ({
        id: conv.user_id,
        customerName: conv.name || 'Unknown',
        customerImage: conv.avatar || 'assets/landingpage_images/profile4.jpg',
        lastMessage: '', // Will be populated when messages load
        lastMessageTime: conv.last_message_at ? new Date(conv.last_message_at) : new Date(),
        unreadCount: conv.unread_count,
        isOnline: false, // TODO: Implement online status via WebSocket
        messages: [],
      }));
      console.log('[MESSAGES] Conversations mapped to UI format:', this.conversations.length);
    } catch (err: any) {
      console.error('[MESSAGING] Error fetching conversations:', err);
      console.error('[MESSAGING] Error status:', err?.status);
      console.error('[MESSAGING] Error details:', err?.error);
      
      // Return empty array to prevent UI from breaking
      console.log('[MESSAGING] No conversations loaded');
      this.conversations = [];
    } finally {
      this.isLoadingConversations = false;
      console.log('[MESSAGES] loadConversations finished, isLoadingConversations = false');
      
      // Force change detection
      this.cdr.detectChanges();
    }
  }

  async loadMessages(conversationId: string): Promise<void> {
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    this.isLoadingMessages = true;
    try {
      const paginated = await this.messaging.fetchMessages(conversationId);

      // Pre-fetch all needed public keys for batch decryption
    const uniqueUserIds = new Set<string>();
    paginated.messages.forEach(msg => {
      const keyUserId = msg.is_outgoing ? msg.recipient_id : msg.sender_id;
      uniqueUserIds.add(keyUserId);
    });
    
    // Pre-fetch all public keys in parallel
    await Promise.all(Array.from(uniqueUserIds).map(userId => 
      this.messaging.preFetchPublicKey(userId)
    ));
    
    console.log('[MESSAGES] Pre-fetched public keys for', uniqueUserIds.size, 'unique users');

    // Batch decrypt messages for better performance
    const decryptPromises = paginated.messages.map(async (storedMsg) => {
      try {
        const plaintext = await this.messaging.decryptMessage(storedMsg);
        return {
          id: storedMsg.id,
          sender: storedMsg.is_outgoing ? 'agent' as const : 'customer' as const,
          text: this.security.sanitizeForDisplay(plaintext),
          timestamp: new Date(storedMsg.created_at),
          status: storedMsg.read_at ? ('read' as const) : ('delivered' as const),
        };
      } catch (decryptError) {
        console.error('[MESSAGES] Decryption failed for message:', storedMsg.id, decryptError);
        // Decryption failed - show locked message
        return {
          id: storedMsg.id,
          sender: storedMsg.is_outgoing ? 'agent' as const : 'customer' as const,
          text: 'Unable to decrypt message',
          timestamp: new Date(storedMsg.created_at),
          status: 'locked' as const,
        };
      }
    });

    // Wait for all decryption to complete
    const decryptedMessages: Message[] = await Promise.all(decryptPromises);
    decryptedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      conversation.messages = decryptedMessages;

      // Update last message preview
      const lastMsg = decryptedMessages[decryptedMessages.length - 1];
      if (lastMsg) {
        conversation.lastMessage = lastMsg.text;
        conversation.lastMessageTime = lastMsg.timestamp;
      }
      
      // Update conversation in conversation list for real-time UI
      const convIndex = this.conversations.findIndex(c => c.id === conversationId);
      if (convIndex !== -1) {
        this.conversations[convIndex] = { ...conversation };
        console.log('[MESSAGES] Updated conversation list in real-time');
      }
    } catch (err) {
      // Error loading messages
    } finally {
      this.isLoadingMessages = false;
    }
  }

  public sendMessage() {
    console.log('[MESSAGES] sendMessage() called');
    if (!this.newMessage.trim() || !this.activeConversation) {
      console.log('[MESSAGES] Cannot send: empty message or no active conversation');
      return;
    }

    // Sanitize input before sending
    const rawText = this.newMessage.trim();
    const validation = this.security.validateInput(rawText);

    if (!validation.valid) {
      console.log('[MESSAGES] Message validation failed, rejecting');
      this.newMessage = '';
      return;
    }

    const text = this.security.sanitizeInput(rawText);
    const recipientId = this.getRecipientId(this.activeConversation);
    console.log('[MESSAGES] Sending message to:', recipientId);

    const { pendingMessage, promise } = this.messaging.sendMessage(
      recipientId,
      text
    );

    const message: Message = {
      id: pendingMessage.id,
      sender: 'agent',
      text: pendingMessage.content,
      timestamp: pendingMessage.timestamp,
      status: 'pending',
    };

    this.activeConversation.messages.push(message);
    this.activeConversation.lastMessage = message.text;
    this.activeConversation.lastMessageTime = message.timestamp;
    this.newMessage = '';
    
    // Force UI update after adding message
    this.cdr.detectChanges();
    
    // Refresh messages for other user to see new messages
    setTimeout(() => {
      const activeConv = this.activeConversation;
      if (activeConv) {
        console.log('[MESSAGES] Refreshing conversation for new messages');
        this.loadMessages(activeConv.id);
      }
    }, 1000);

    promise
      .then(() => {
        console.log('[MESSAGES] Message sent successfully');
        message.status = 'sent';
        
        // Update message status in real-time for both sender and receiver
        this.updateMessageStatus(message.id, 'sent');
      })
      .catch((err) => {
        message.status = 'failed';
        console.error('[MESSAGES] Failed to send message:', err);
        // Show specific error for missing recipient key
        if (err?.error?.includes('No public key found')) {
          console.error('[MESSAGES] Please ensure the recipient has a public key in the system');
        }
      });

    this.conversations.sort((a, b) => {
      if (a.id === this.activeConversationId) return -1;
      if (b.id === this.activeConversationId) return 1;
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });
  }

  private getRecipientId(conversation: UiConversation): string {
    // The conversation ID is the recipient's user UUID
    return conversation.id;
  }

  ngOnInit(): void {
    console.log('[MESSAGES] ngOnInit - Component initializing');

    // Initialize key sync
    this.keySync.initialize();

    // Connect to realtime (non-blocking - WebSocket failures shouldn't break UI)
    try {
      console.log('[MESSAGES] Attempting WebSocket connection...');
      this.realtime.connect();
    } catch (err) {
      console.warn('[MESSAGES] Realtime connection failed (non-critical):', err);
    }

    // Load conversations first, then handle new conversation from query params
    console.log('[MESSAGES] Starting to load conversations...');
    this.loadConversations().then(() => {
      console.log('[MESSAGES] Conversations loaded, checking query params...');
      this.route.queryParams.subscribe(params => {
        const userId = params['userId'];
        const name = params['name'];
        console.log('[MESSAGES] Query params:', { userId, name });

        if (userId) {
          console.log('[MESSAGES] Creating new conversation from query params');
          this.handleNewConversation(userId, name);
        } else {
          // No query params - select first conversation if available
          console.log('[MESSAGES] No query params, selecting first conversation');
          if (this.conversations.length > 0) {
            this.selectConversation(this.conversations[0].id);
            console.log('[MESSAGES] Selected first conversation:', this.conversations[0].id);
          } else {
            console.log('[MESSAGES] No conversations available');
          }
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.realtime.disconnect();
    this.messageSubscription?.unsubscribe();
  }

  private handleNewConversation(userId: string, name?: string): void {
    console.log('[MESSAGES] handleNewConversation called:', { userId, name });

    // Check if conversation already exists
    let conversation = this.conversations.find(c => c.id === userId);
    console.log('[MESSAGES] Existing conversation found:', !!conversation);

    if (!conversation) {
      // Create temporary conversation for new chat
      console.log('[MESSAGES] Creating new conversation for user:', userId);
      conversation = {
        id: userId,
        customerName: name || 'Unknown',
        customerImage: 'assets/landingpage_images/profile4.jpg',
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0,
        isOnline: false,
        messages: [],
      };
      this.conversations.unshift(conversation);
      console.log('[MESSAGES] New conversation created and added to list');
      console.log('[MESSAGES] Total conversations after adding:', this.conversations.length);
      
      // Force change detection to ensure UI updates immediately
      this.conversations = [...this.conversations];
      
      // Force immediate UI update
      this.cdr.detectChanges();
      console.log('[MESSAGES] Manual change detection triggered');
    }

    // Auto-select the conversation (don't load messages for new/empty ones)
    this.activeConversationId = userId;
    this.showMobileChat = true;
    console.log('[MESSAGES] Conversation selected, showMobileChat = true');
    console.log('[MESSAGES] Active conversation set to:', this.activeConversationId);
    
    // Force change detection to ensure UI updates
    setTimeout(() => {
      console.log('[MESSAGES] UI should be updated now');
    }, 100);
  }

  private handleIncomingMessage(incoming: DecryptedMessage): void {
    console.log('[MESSAGES] Handling incoming message:', incoming);
    console.log('[MESSAGES] Available conversations:', this.conversations.map(c => ({ id: c.id, name: c.customerName })));
    
    const conversationId = this.getConversationIdBySender(incoming.senderId);
    console.log('[MESSAGES] Found conversation ID:', conversationId, 'for sender:', incoming.senderId);
    
    if (!conversationId) {
      console.log('[MESSAGES] No conversation found for incoming message');
      return;
    }

    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) {
      console.log('[MESSAGES] No conversation found for ID:', conversationId);
      return;
    }

    const existingMessage = conversation.messages.find(m => m.id === incoming.id);
    if (existingMessage) {
      return;
    }

    // Sanitize incoming message content before display
    const rawContent = incoming.content ?? 'Unable to decrypt message';
    const sanitizedContent = this.security.sanitizeForDisplay(rawContent);

    const message: Message = {
      id: incoming.id,
      sender: 'customer',
      text: sanitizedContent,
      timestamp: incoming.timestamp,
      status: incoming.status,
    };

    conversation.messages.push(message);
    conversation.lastMessage = sanitizedContent;
    conversation.lastMessageTime = message.timestamp;

    if (this.activeConversationId !== conversationId) {
      conversation.unreadCount++;
      console.log('[MESSAGES] Incrementing unread count for conversation:', conversationId);
    }

    // Force UI update to show new message in conversation list
    this.cdr.detectChanges();
    console.log('[MESSAGES] Updated conversation with new message:', conversationId);
  }

  private getConversationIdBySender(senderId: string): string | null {
    // For incoming messages, find conversation where current user is the recipient
    // The conversation ID is the other user's UUID
    const conversation = this.conversations.find(c => c.id === senderId);
    return conversation?.id ?? null;
  }

  private updateMessageStatus(messageId: string | number, status: Message['status']): void {
    // Update message status in conversation
    for (const conversation of this.conversations) {
      const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        conversation.messages[messageIndex].status = status;
        console.log(`[MESSAGES] Updated message ${messageId} status to: ${status}`);
      }
    }
    
    // Force UI update
    this.cdr.detectChanges();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  public getTotalUnreadCount(): number {
    return this.conversations.reduce((sum: number, c: UiConversation) => sum + c.unreadCount, 0);
  }

  public formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
