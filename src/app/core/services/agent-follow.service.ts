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

@Injectable({ providedIn: 'root' })
export class AgentFollowService {
  private readonly api = inject(ApiService);
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
