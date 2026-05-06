import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MessagingService, type StoredMessage } from './messaging.service';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DecryptedMessage {
  id: number;
  senderId: string;
  content: string | null;
  timestamp: Date;
  status: 'received' | 'failed';
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  error?: string;
  reconnectAttempts?: number;
}

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private auth = inject(AuthService);
  private messaging = inject(MessagingService);

  readonly incomingMessage = signal<DecryptedMessage | null>(null);
  readonly connectionState = signal<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0
  });

  private messageSubject = new Subject<DecryptedMessage>();
  readonly message$ = this.messageSubject.asObservable();
  readonly connectionState$ = new Subject<ConnectionState>();

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnected = false;
  private processedIds = new Set<number>();

  private updateConnectionState(
    status: ConnectionState['status'], 
    error?: string, 
    reconnectAttempts?: number
  ): void {
    const newState: ConnectionState = {
      status,
      error,
      reconnectAttempts: reconnectAttempts !== undefined ? reconnectAttempts : this.reconnectAttempts
    };
    
    this.connectionState.set(newState);
    this.connectionState$.next(newState);
    
    console.log('[WEBSOCKET] Connection state updated:', newState);
  }

  private startPingInterval(): void {
    // Clear existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Start new ping interval (every 30 seconds)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[WEBSOCKET] Sending ping');
        this.ws.send(JSON.stringify({event: 'pusher:ping', data: {}}));
      }
    }, 30000);
  }

  connect(): void {
    console.log('[WEBSOCKET] connect() called');
    
    const user = this.auth.getUser();
    if (!user) {
      console.log('[WEBSOCKET] No user, skipping connection');
      this.updateConnectionState('disconnected', 'No authenticated user');
      return;
    }

    const token = this.auth.getToken();
    if (!token) {
      console.log('[WEBSOCKET] No token, skipping connection');
      this.updateConnectionState('disconnected', 'No authentication token');
      return;
    }

    // Update connection state
    const currentState = this.connectionState();
    this.updateConnectionState('connecting', undefined, currentState.reconnectAttempts);

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      const wsUrl = this.buildWsUrl(user.uuid, token);
      console.log('[WEBSOCKET] Creating WebSocket with URL:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.warn('[WEBSOCKET] Connection timeout after 5 seconds');
          this.ws?.close();
        }
      }, 5000);

      this.ws.onopen = (event) => {
        this.isConnected = true;
        console.log('[WEBSOCKET] Connected successfully!');
        
        // Clear connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        // Reset reconnect attempts
        this.reconnectAttempts = 0;
        
        // Update connection state
        this.updateConnectionState('connected');
        
        // Start ping interval for connection health
        this.startPingInterval();
        
        // Subscribe to user's private channel
        const user = this.auth.getUser();
        if (user) {
          const channelName = `user.${user.uuid}`;
          const token = this.auth.getToken();
          console.log('[WEBSOCKET] Attempting to subscribe to channel:', channelName);
          
          const subscribeMessage = {
            event: 'pusher:subscribe',
            data: {
              channel: channelName,
              auth: token
            }
          };
          
          console.log('[WEBSOCKET] Sending subscription message:', subscribeMessage);
          this.ws?.send(JSON.stringify(subscribeMessage));
          console.log('[WEBSOCKET] Subscription message sent to channel:', channelName);
        } else {
          console.log('[WEBSOCKET] No user found for channel subscription');
          this.updateConnectionState('error', 'No user found for channel subscription');
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          console.log('[WEBSOCKET] Raw message received:', event.data);
          const payload = JSON.parse(event.data);
          console.log('[WEBSOCKET] Parsed payload:', payload);
          if (payload.event === 'message.sent') {
            console.log('[WEBSOCKET] Handling incoming message:', payload.data);
            await this.handleIncomingMessage(payload.data);
          } else if (payload.event === 'pusher_internal:subscription_succeeded') {
            console.log('[WEBSOCKET] Channel subscription successful:', payload.channel);
          } else if (payload.event === 'pusher_internal:subscription_error') {
            console.log('[WEBSOCKET] Channel subscription failed:', payload);
          } else if (payload.event === 'pusher:ping') {
            console.log('[WEBSOCKET] Ping received, sending pong');
            this.ws?.send(JSON.stringify({event: 'pusher:pong', data: {}}));
          } else {
            console.log('[WEBSOCKET] Unknown event type:', payload.event);
          }
        } catch (err) {
          console.warn('[WEBSOCKET] Error processing message:', err);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        console.log('[WEBSOCKET] Connection closed:', event.code, event.reason);
        
        // Clear ping interval
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        
        // Don't reconnect if clean close or max attempts reached
        if (event.code === 1000 || this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('[WEBSOCKET] Not reconnecting - clean close or max attempts reached');
          this.updateConnectionState('disconnected', event.reason || 'Connection closed');
          return;
        }
        
        // Update connection state and attempt reconnect
        this.updateConnectionState('reconnecting', `Connection closed (${event.code}): ${event.reason}`, this.reconnectAttempts);
        this.attemptReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[WEBSOCKET] Error:', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[WEBSOCKET] Exception during connect():', err);
    }
  }

  disconnect(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
    this.processedIds.clear();
    this.updateConnectionState('disconnected', 'Disconnected manually');
  }

  private async handleIncomingMessage(data: StoredMessage): Promise<void> {
    if (this.processedIds.has(data.id)) {
      return;
    }
    this.processedIds.add(data.id);

    try {
      const plaintext = await this.messaging.decryptMessage(data);

      const message: DecryptedMessage = {
        id: data.id,
        senderId: data.sender_id,
        content: plaintext,
        timestamp: new Date(data.created_at),
        status: 'received',
      };

      this.incomingMessage.set(message);
      this.messageSubject.next(message);
    } catch (err) {
      const failedMessage: DecryptedMessage = {
        id: data.id,
        senderId: data.sender_id,
        content: null,
        timestamp: new Date(data.created_at),
        status: 'failed',
      };

      this.incomingMessage.set(failedMessage);
      this.messageSubject.next(failedMessage);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  private buildWsUrl(userId: string, token: string): string {
    // Hardcode localhost for development since environment file seems corrupted
    const apiUrl = 'http://localhost:8000/api/v1';
    const wsProtocol = 'ws:';
    const baseUrl = apiUrl.replace(/^https?:/, wsProtocol).replace(/:\d+/, ':6001').replace(/\/api\/v1\/?$/, '');
    const appKey = environment.reverbAppKey;
    const finalUrl = `${baseUrl}/app/${appKey}?protocol=7&client=js&version=7.0.3&flash=false&user=${userId}&token=${token}`;
    console.log('[WEBSOCKET] Building URL:', finalUrl);
    return finalUrl;
  }

  isDuplicate(id: number): boolean {
    return this.processedIds.has(id);
  }

  clearProcessedIds(): void {
    this.processedIds.clear();
  }
}
