import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, input, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { SITE_URL } from '../../../core/services/seo.service';

@Component({
  selector: 'app-agent-share',
  host: { class: 'block min-w-0' },
  template: `
    <button type="button" (click)="share()" [disabled]="!agentUuid() || busy()" [class.w-full]="compact()" [class.px-2]="compact()" [class.px-4]="!compact()"
            class="min-w-0 min-h-10 inline-flex items-center justify-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm whitespace-nowrap rounded-full border border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50">
      <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Share
    </button>
    @if (showLink()) {
      <div class="mt-3 w-full">
        <label class="block text-xs text-gray-500 dark:text-gray-400">Your direct profile link
          <input type="text" readonly [value]="profileUrl" (focus)="$any($event.target).select()" class="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#222] px-3 py-2 text-sm text-gray-800 dark:text-gray-100" />
        </label>
      </div>
    }
  `,
})
export class AgentShare {
  readonly compact = input(false);
  readonly agentUuid = input('');
  readonly agentName = input('');
  readonly busy = signal(false);
  readonly showLink = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly toast = inject(ToastService);
  get profileUrl(): string {
    const origin = this.browser ? this.document.location.origin : SITE_URL;
    return `${origin}/agent/${encodeURIComponent(this.agentUuid())}`;
  }
  async share(): Promise<void> {
    if (!this.browser || !this.agentUuid() || this.busy()) return;
    this.busy.set(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${this.agentName() || 'Our agency'} on Pilikapilika`, url: this.profileUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.profileUrl);
        this.toast.success('Profile link copied.');
      } else {
        this.showLink.set(true);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) this.showLink.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
