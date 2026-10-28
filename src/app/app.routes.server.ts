import { inject } from '@angular/core';
import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { firstValueFrom, timeout } from 'rxjs';
import { AgentService } from './core/services/agent.service';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about-us', renderMode: RenderMode.Prerender },
  { path: 'search', renderMode: RenderMode.Prerender },
  { path: 'how-it-works', renderMode: RenderMode.Prerender },
  { path: 'contact-us', renderMode: RenderMode.Prerender },
  {
    path: 'agent/:id',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      const agents = inject(AgentService);
      const ids = new Set<string>();
      try {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const result = await firstValueFrom(agents.getAvailableAgents(page, 100).pipe(timeout(8000)));
          for (const agent of result.agents) {
            // UUID is the canonical public identifier. Do not generate numeric duplicates.
            if (agent.uuid && /^[a-zA-Z0-9-]+$/.test(agent.uuid)) ids.add(agent.uuid);
          }
          hasMore = result.pagination.has_more;
          page++;
        }
      } catch {
        // A build before the API goes live can still publish the main public pages.
        // Do not publish a partial list if a later API page fails.
        console.warn('Agent prerendering skipped: public API unavailable. Rebuild once the VPS is online.');
        return [];
      }
      return [...ids].map(id => ({ id }));
    },
  },
  { path: '**', renderMode: RenderMode.Client },
];
