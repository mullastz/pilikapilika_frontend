import { TestBed } from '@angular/core/testing';
import { RenderMode } from '@angular/ssr';
import { of, throwError } from 'rxjs';
import { AgentService } from './core/services/agent.service';
import { serverRoutes } from './app.routes.server';

describe('Public agent prerender discovery', () => {
  const load = vi.fn();

  beforeEach(() => {
    load.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: AgentService, useValue: { getAvailableAgents: load } }] });
  });

  async function discover() {
    const route = serverRoutes.find(route => route.path === 'agent/:id');
    if (route?.renderMode !== RenderMode.Prerender || !('getPrerenderParams' in route)) throw new Error('Missing agent prerender route');
    const getParams = route.getPrerenderParams;
    return TestBed.runInInjectionContext(() => getParams());
  }

  it('prerenders the homepage and all four public navigation pages', () => {
    for (const path of ['', 'search', 'how-it-works', 'about-us', 'contact-us']) {
      expect(serverRoutes.find(route => route.path === path)?.renderMode).toBe(RenderMode.Prerender);
    }
  });

  it('reads every API page and emits unique UUIDs without numeric aliases', async () => {
    load.mockReturnValueOnce(of({ agents: [{ id: 1, uuid: 'agent-one' }], pagination: { has_more: true } }))
      .mockReturnValueOnce(of({ agents: [{ id: 1, uuid: 'agent-one' }, { id: 2, uuid: 'agent-two' }, { id: 3 }], pagination: { has_more: false } }));
    expect(await discover()).toEqual([{ id: 'agent-one' }, { id: 'agent-two' }]);
    expect(load).toHaveBeenNthCalledWith(2, 2, 100);
  });

  it('discards incomplete discovery if a later API page fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    load.mockReturnValueOnce(of({ agents: [{ uuid: 'agent-one' }], pagination: { has_more: true } }))
      .mockReturnValueOnce(throwError(() => new Error('API offline')));
    expect(await discover()).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
