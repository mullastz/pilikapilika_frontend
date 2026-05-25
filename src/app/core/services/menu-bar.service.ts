import { Injectable, signal } from '@angular/core';

/**
 * Shared service to control menu-bar visibility across components.
 * Used by modals (shipping, etc.) to hide the menu-bar when open
 * and restore it when closed — essential for mobile bottom sheet UX.
 */
@Injectable({
  providedIn: 'root'
})
export class MenuBarService {
  /** When true, the menu-bar is forced hidden regardless of route/scroll state */
  hidden = signal(false);

  /** Number of active modal callers. Allows nested modals without flicker. */
  private _hideCount = 0;

  hide(): void {
    this._hideCount++;
    this.hidden.set(true);
  }

  show(): void {
    this._hideCount = Math.max(0, this._hideCount - 1);
    if (this._hideCount === 0) {
      this.hidden.set(false);
    }
  }

  /** Force reset — useful on route change to prevent stale state */
  reset(): void {
    this._hideCount = 0;
    this.hidden.set(false);
  }
}
