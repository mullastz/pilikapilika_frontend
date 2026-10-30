import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-hero',
  template: `
    <section class="relative isolate flex min-h-72 items-center justify-center overflow-hidden rounded-3xl bg-gray-900 px-6 py-16 text-center text-white sm:min-h-88 sm:px-10 sm:py-20">
      @if (imageUrl()) {
        <img [src]="imageUrl()" alt="" aria-hidden="true" fetchpriority="high"
          class="absolute inset-0 h-full w-full scale-105 object-cover blur-[1px]" />
      }
      <div class="absolute inset-0 bg-black/55" aria-hidden="true"></div>
      <div class="relative z-10 mx-auto w-full max-w-3xl wrap-break-word">
        <h1 class="text-3xl font-bold tracking-tight sm:text-5xl">{{ title() }}</h1>
        <p class="mt-5 whitespace-pre-line text-base leading-relaxed text-white/90 sm:text-lg">{{ subtitle() }}</p>
        <ng-content />
      </div>
    </section>
  `,
})
export class PageHero {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly imageUrl = input('');
}
