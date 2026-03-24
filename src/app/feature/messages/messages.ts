import { Component } from '@angular/core';
import { CommonModule, Location  } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

interface Message {
  id: number;
  sender: 'agent' | 'customer';
  text: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

interface Conversation {
  id: number;
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
export class Messages {
  activeConversationId: number | null = null;
  newMessage = '';
  showMobileChat = false;
  constructor( private route: ActivatedRoute, private location: Location) {}

  conversations: Conversation[] = [
    {
      id: 1,
      customerName: 'Michael K.',
      customerImage: 'assets/landingpage_images/profile4.jpg',
      lastMessage: 'Thanks for the quick delivery!',
      lastMessageTime: new Date(Date.now() - 5 * 60 * 1000),
      unreadCount: 0,
      isOnline: true,
      messages: [
        {
          id: 1,
          sender: 'customer',
          text: 'Hi, I need help with my shipment tracking.',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          status: 'read',
        },
        {
          id: 2,
          sender: 'agent',
          text: 'Hello! I\'d be happy to help. Could you please provide your tracking number?',
          timestamp: new Date(Date.now() - 25 * 60 * 1000),
          status: 'read',
        },
        {
          id: 3,
          sender: 'customer',
          text: 'It\'s PKG123456789',
          timestamp: new Date(Date.now() - 20 * 60 * 1000),
          status: 'read',
        },
        {
          id: 4,
          sender: 'agent',
          text: 'Thank you! I can see your package is currently in transit and should arrive tomorrow.',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          status: 'read',
        },
        {
          id: 5,
          sender: 'customer',
          text: 'Thanks for the quick delivery!',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          status: 'read',
        },
      ],
    },
    {
      id: 2,
      customerName: 'Sarah T.',
      customerImage: 'assets/landingpage_images/profile4.jpg',
      lastMessage: 'Can you source electronics from Guangzhou?',
      lastMessageTime: new Date(Date.now() - 15 * 60 * 1000),
      unreadCount: 2,
      isOnline: false,
      messages: [
        {
          id: 1,
          sender: 'customer',
          text: 'Hi there!',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          status: 'read',
        },
        {
          id: 2,
          sender: 'agent',
          text: 'Hello! How can I help you today?',
          timestamp: new Date(Date.now() - 40 * 60 * 1000),
          status: 'read',
        },
        {
          id: 3,
          sender: 'customer',
          text: 'Can you source electronics from Guangzhou?',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          status: 'delivered',
        },
      ],
    },
    {
      id: 3,
      customerName: 'David L.',
      customerImage: 'assets/landingpage_images/profile4.jpg',
      lastMessage: 'What are your rates for bulk orders?',
      lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      unreadCount: 0,
      isOnline: true,
      messages: [
        {
          id: 1,
          sender: 'customer',
          text: 'Hello, I have a bulk order inquiry.',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
          status: 'read',
        },
        {
          id: 2,
          sender: 'agent',
          text: 'Hi David! I can definitely help with bulk orders. What products are you looking for?',
          timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
          status: 'read',
        },
        {
          id: 3,
          sender: 'customer',
          text: 'What are your rates for bulk orders?',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          status: 'read',
        },
      ],
    },
    {
      id: 4,
      customerName: 'Amina R.',
      customerImage: 'assets/landingpage_images/profile4.jpg',
      lastMessage: 'Perfect, thank you!',
      lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      unreadCount: 0,
      isOnline: false,
      messages: [
        {
          id: 1,
          sender: 'agent',
          text: 'Your package has been delivered successfully.',
          timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
          status: 'read',
        },
        {
          id: 2,
          sender: 'customer',
          text: 'Perfect, thank you!',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          status: 'read',
        },
      ],
    },
    {
      id: 5,
      customerName: 'John P.',
      customerImage: 'assets/landingpage_images/profile4.jpg',
      lastMessage: 'Can I get a quote for shipping 50kg?',
      lastMessageTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      unreadCount: 1,
      isOnline: true,
      messages: [
        {
          id: 1,
          sender: 'customer',
          text: 'Hi, I need a shipping quote.',
          timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          status: 'read',
        },
        {
          id: 2,
          sender: 'agent',
          text: 'Hi John! Sure, please let me know the weight and destination.',
          timestamp: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000),
          status: 'read',
        },
        {
          id: 3,
          sender: 'customer',
          text: 'Can I get a quote for shipping 50kg?',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          status: 'delivered',
        },
      ],
    },
  ];
  
  goBack() {
    this.location.back();
  }
  get activeConversation(): Conversation | undefined {
    return this.conversations.find((c) => c.id === this.activeConversationId);
  }

  selectConversation(id: number) {
    this.activeConversationId = id;
    this.showMobileChat = true;
    const conversation = this.conversations.find((c) => c.id === id);
    if (conversation) {
      conversation.unreadCount = 0;
    }
  }

  closeMobileChat() {
    this.showMobileChat = false;
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.activeConversation) return;

    const message: Message = {
      id: Date.now(),
      sender: 'agent',
      text: this.newMessage.trim(),
      timestamp: new Date(),
      status: 'sent',
    };

    this.activeConversation.messages.push(message);
    this.activeConversation.lastMessage = message.text;
    this.activeConversation.lastMessageTime = message.timestamp;
    this.newMessage = '';

    // Sort conversations to bring active one to top
    this.conversations.sort((a, b) => {
      if (a.id === this.activeConversationId) return -1;
      if (b.id === this.activeConversationId) return 1;
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  getTotalUnreadCount(): number {
    return this.conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }
}
