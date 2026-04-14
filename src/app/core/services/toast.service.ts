import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts = signal<Toast[]>([]);
  private nextId = 0;

  readonly activeToasts = this.toasts.asReadonly();

  show(message: string, type: Toast['type'] = 'info', duration: number = 5000): void {
    const toast: Toast = {
      id: ++this.nextId,
      message,
      type,
      duration
    };

    this.toasts.update(current => [...current, toast]);

    // Auto remove after duration
    setTimeout(() => {
      this.remove(toast.id);
    }, duration);
  }

  success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  remove(id: number): void {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}
