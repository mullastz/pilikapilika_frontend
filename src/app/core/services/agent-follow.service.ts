import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Agent } from '../interfaces/auth.interface';

export interface AgencyFollower {
  uuid: string;
  firstname: string | null;
  lastname: string | null;
  profile_photo: string | null;
  region: string | null;
  district: string | null;
  followed_at: string;
}

export interface AgencyFollowersData {
  followers: AgencyFollower[];
  pagination: { current_page: number; last_page: number; has_more: boolean; total: number };
}

/** Agent whose invite link was opened before the visitor signed in; followed once they are signed in. */
const PENDING_INVITE_KEY = 'pending_invite_agent';

@Injectable({ providedIn: 'root' })
export class AgentFollowService {
  private readonly api = inject(ApiService);
  rememberInvite(uuid: string): void {
    try { localStorage.setItem(PENDING_INVITE_KEY, uuid); } catch { /* storage unavailable */ }
  }
  /** Returns and clears the agent from a pending invite link, if any. */
  takePendingInvite(): string | null {
    try {
      const uuid = localStorage.getItem(PENDING_INVITE_KEY);
      localStorage.removeItem(PENDING_INVITE_KEY);
      return uuid;
    } catch { return null; }
  }
  followers(page = 1, query = '') {
    return this.api.get<{ data: AgencyFollowersData }>('agency/followers', { page: String(page), per_page: '20', q: query });
  }
  list(page = 1) {
    return this.api.get<{ data: { agents: Agent[]; pagination: { current_page: number; has_more: boolean; total: number } } }>(`following-agents?page=${page}&per_page=20`);
  }
  status(uuid: string) { return this.api.get<{ data: { following: boolean } }>(`following-agents/${encodeURIComponent(uuid)}`); }
  follow(uuid: string) { return this.api.post<{ data: { following: boolean } }>(`following-agents/${encodeURIComponent(uuid)}`, {}); }
  unfollow(uuid: string) { return this.api.delete<{ data: { following: boolean } }>(`following-agents/${encodeURIComponent(uuid)}`); }
}
