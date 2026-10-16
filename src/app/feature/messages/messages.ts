import { Component, OnInit, OnDestroy, ViewChild, ElementRef, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location  } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessagingService, type PendingMessage, type ApiConversation, type StoredMessage } from '../../core/services/messaging.service';
import { RealtimeService, type DecryptedMessage, type ConnectionState } from '../../core/services/realtime.service';
import { IdentityService } from '../../core/services/crypto/identity.service';
import { SecurityService } from '../../core/services/crypto/security.service';
import { KeySyncService } from '../../core/services/key-sync.service';
import { Subscription } from 'rxjs';

interface Message {
  id: number | string;
  sender: 'agent' | 'customer';
  text: string;
  timestamp: Date;
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received' | 'locked';
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
  isSendingMessage = false;
  errorMessage: string | null = null;
  connectionState: ConnectionState = { status: 'disconnected' };

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  private messaging = inject(MessagingService);
  private realtime = inject(RealtimeService);
  private identity = inject(IdentityService);
  private security = inject(SecurityService);
  private keySync = inject(KeySyncService);
  private cdr = inject(ChangeDetectorRef);

  private messageSubscription: Subscription | null = null;
  private connectionStateSubscription: Subscription | null = null;

  conversations: UiConversation[] = [];
  pendingMessages: Map<string, PendingMessage> = new Map();

  constructor(private route: ActivatedRoute, private location: Location) {
    effect(() => {
      const incoming = this.realtime.incomingMessage();
      if (incoming) {
        this.handleIncomingMessage(incoming);
      }
    });

    // Subscribe to connection state changes
    this.connectionStateSubscription = this.realtime.connectionState$.subscribe((state) => {
      this.connectionState = state;
      
      // Clear error message when connection is restored
      if (state.status === 'connected') {
        this.errorMessage = null;
      }
      
      // Show connection error to user
      if (state.status === 'error' && state.error) {
        this.errorMessage = `Connection error: ${state.error}`;
      }
      
      this.cdr.detectChanges();
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
    }
  }

  closeMobileChat() {
    this.showMobileChat = false;
  }

  async loadConversations(): Promise<void> {
    this.isLoadingConversations = true;
    this.errorMessage = null;

    try {
      
      const apiConversations = await this.messaging.fetchConversations();
      
      this.conversations = (apiConversations as any[]).map((conv: any): UiConversation => ({
        id: conv.user_id,
        customerName: conv.name || 'Unknown',
        customerImage: conv.avatar || 'assets/landingpage_images/profile4.jpg',
        lastMessage: '', // Will be populated when messages load
        lastMessageTime: conv.last_message_at ? new Date(conv.last_message_at) : new Date(),
        unreadCount: conv.unread_count,
        isOnline: this.connectionState.status === 'connected', // Online based on connection state
        messages: [],
      }));
    } catch (err: any) {
      
      // Show user-friendly error message
      this.errorMessage = 'Failed to load conversations. Please try again.';
      
      // Return empty array to prevent UI from breaking
      this.conversations = [];
    } finally {
      this.isLoadingConversations = false;
      
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
      }
    } catch (err) {
      // Error loading messages
    } finally {
      this.isLoadingMessages = false;
    }
  }

  public sendMessage() {
    
    // Clear previous error messages
    this.errorMessage = null;
    
    if (!this.newMessage.trim() || !this.activeConversation) {
      if (!this.newMessage.trim()) {
        this.errorMessage = 'Message cannot be empty';
      }
      return;
    }

    // Check connection state before sending
    if (this.connectionState.status === 'disconnected' || this.connectionState.status === 'error') {
      this.errorMessage = 'Cannot send message - connection lost. Please wait for reconnection.';
      return;
    }

    // Prevent sending while already sending
    if (this.isSendingMessage) {
      return;
    }

    this.isSendingMessage = true;

    // Sanitize input before sending
    const rawText = this.newMessage.trim();
    const validation = this.security.validateInput(rawText);

    if (!validation.valid) {
      this.errorMessage = 'Message contains invalid content';
      this.isSendingMessage = false;
      this.newMessage = '';
      return;
    }

    const text = this.security.sanitizeInput(rawText);
    const recipientId = this.getRecipientId(this.activeConversation);

    try {
      const { pendingMessage, promise } = this.messaging.sendMessage(
        recipientId,
        text
      );

      // Track pending message
      this.pendingMessages.set(pendingMessage.id, pendingMessage);

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
      
      // Scroll to bottom after adding message
      this.scrollToBottom();

      promise
        .then(() => {
          message.status = 'sent';
          
          // Update message status in real-time for both sender and receiver
          this.updateMessageStatus(message.id, 'sent');
          
          // Remove from pending messages
          this.pendingMessages.delete(pendingMessage.id);
        })
        .catch((err) => {
          message.status = 'failed';
          
          // Remove from pending messages
          this.pendingMessages.delete(pendingMessage.id);
          
          // Show user-friendly error message
          if (err?.message) {
            this.errorMessage = `Failed to send: ${err.message}`;
          } else {
            this.errorMessage = 'Failed to send message. Please try again.';
          }
        })
        .finally(() => {
          this.isSendingMessage = false;
          this.cdr.detectChanges();
        });

      this.conversations.sort((a, b) => {
        if (a.id === this.activeConversationId) return -1;
        if (b.id === this.activeConversationId) return 1;
        return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
      });
    } catch (err: any) {
      this.errorMessage = 'Failed to send message. Please try again.';
      this.isSendingMessage = false;
      this.cdr.detectChanges();
    }
  }

  private getRecipientId(conversation: UiConversation): string {
    // The conversation ID is the recipient's user UUID
    return conversation.id;
  }

  ngOnInit(): void {

    // Initialize key sync
    this.keySync.initialize();

    // Connect to realtime (non-blocking - WebSocket failures shouldn't break UI)
    try {
      this.realtime.connect();
    } catch (err) {
    }

    // Load conversations first, then handle new conversation from query params
    this.loadConversations().then(() => {
      this.route.queryParams.subscribe(params => {
        const userId = params['userId'];
        const name = params['name'];

        if (userId) {
          this.handleNewConversation(userId, name);
        } else {
          // No query params - select first conversation if available
          if (this.conversations.length > 0) {
            this.selectConversation(this.conversations[0].id);
          } else {
          }
        }
      });
    });
  }

  ngOnDestroy(): void {
    
    // Disconnect from realtime
    this.realtime.disconnect();
    
    // Clean up subscriptions
    this.messageSubscription?.unsubscribe();
    this.connectionStateSubscription?.unsubscribe();
    
    // Clear pending messages
    this.pendingMessages.clear();
    
  }

  private handleNewConversation(userId: string, name?: string): void {

    // Check if conversation already exists
    let conversation = this.conversations.find(c => c.id === userId);

    if (!conversation) {
      // Create temporary conversation for new chat
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
      
      // Force change detection to ensure UI updates immediately
      this.conversations = [...this.conversations];
      
      // Force immediate UI update
      this.cdr.detectChanges();
    }

    // Auto-select the conversation (don't load messages for new/empty ones)
    this.activeConversationId = userId;
    this.showMobileChat = true;
    
    // Force change detection to ensure UI updates
    setTimeout(() => {
    }, 100);
  }

  private handleIncomingMessage(incoming: DecryptedMessage): void {
    
    const conversationId = this.getConversationIdBySender(incoming.senderId);
    
    if (!conversationId) {
      return;
    }

    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) {
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
    }

    // Force UI update to show new message in conversation list
    this.cdr.detectChanges();
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

  // Connection state utility methods
  public get connectionStatusText(): string {
    switch (this.connectionState.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return `Reconnecting... (${this.connectionState.reconnectAttempts || 0}/5)`;
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  }

  
  public clearError(): void {
    this.errorMessage = null;
    this.cdr.detectChanges();
  }

  public retryConnection(): void {
    this.errorMessage = null;
    this.realtime.connect();
  }

  public getMessageStatusIcon(status: Message['status']): string {
    switch (status) {
      case 'pending':
        return '•';
      case 'sending':
        return '•';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      case 'failed':
        return '✗';
      case 'received':
        return '•';
      case 'locked':
        return '•';
      default:
        return '';
    }
  }

  public canSendMessage(): boolean {
    return !this.isSendingMessage && 
           this.connectionState.status === 'connected' && 
           !!this.activeConversation &&
           this.newMessage.trim().length > 0;
  }
}
