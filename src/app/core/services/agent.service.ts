import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  Agent,
  AgentProfileResponse,
  UpdateAgentProfileRequest,
  AgentVerificationRequestResponse,
  AgentVerificationStatus
} from '../interfaces/auth.interface';

/**
 * AgentService - Handles agent-related operations
 * (Agent profile, Agent verification, Agent discovery)
 */
@Injectable({
  providedIn: 'root'
})
export class AgentService {
  constructor(private api: ApiService) {}

  // ========== Agent Profile APIs (Authenticated) ==========

  getAgentProfile(userId: number): Observable<Agent> {
    return this.api.get<{ data: Agent }>(`agents/${userId}/profile`).pipe(
      map(response => response.data)
    );
  }

  updateAgentProfile(userId: number, data: UpdateAgentProfileRequest): Observable<AgentProfileResponse> {
    return this.api.put<AgentProfileResponse>(`agents/${userId}/profile`, data);
  }

  // ========== Agent Verification APIs ==========

  requestVerification(): Observable<AgentVerificationRequestResponse> {
    return this.api.post<AgentVerificationRequestResponse>('agent/request-verification', {});
  }

  cancelVerification(): Observable<{ message: string; data?: { status: string } }> {
    return this.api.post<{ message: string; data?: { status: string } }>('agent/cancel-verification', {});
  }

  getVerificationStatus(): Observable<AgentVerificationStatus> {
    // Get current user from localStorage and check agent_verified_at
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      return new Observable(observer => {
        observer.next({
          is_verified: !!userData.agent_verified_at,
          verified_at: userData.agent_verified_at,
          verified_by: userData.agent_verified_by,
          requested_at: userData.agent_verification_requested_at
        });
        observer.complete();
      });
    }
    return new Observable(observer => {
      observer.next({ is_verified: false });
      observer.complete();
    });
  }

  // ========== Admin Agent APIs ==========

  verifyAgent(agentId: number): Observable<{ message: string; data: Agent }> {
    return this.api.post<{ message: string; data: Agent }>(`admin/agents/${agentId}/verify`, {});
  }

  rejectAgent(agentId: number, reason: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`admin/agents/${agentId}/reject`, { reason });
  }

  getPendingVerifications(): Observable<Agent[]> {
    return this.api.get<{ data: Agent[] }>('admin/agents/pending-verifications').pipe(
      map(response => response.data)
    );
  }

  // ========== Public Agent Discovery (No authentication required) ==========

  getAvailableAgents(page: number = 1, perPage: number = 10): Observable<{ agents: Agent[]; pagination: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean } }> {
    return this.api.get<any>(`agents?page=${page}&per_page=${perPage}`).pipe(
      map(response => {
        // Handle both old flat array format and new paginated format
        if (Array.isArray(response.data)) {
          return {
            agents: response.data,
            pagination: { current_page: 1, last_page: 1, per_page: response.data.length, total: response.data.length, has_more: false }
          };
        }
        // New paginated response via ResponseHelper::paginatedResponse
        const content = response.data?.content ?? response.data?.agents ?? [];
        const pageable = response.data?.pageable;
        if (pageable) {
          return {
            agents: content,
            pagination: {
              current_page: (pageable.pageNumber ?? 0) + 1,
              last_page: response.data.totalPages ?? 1,
              per_page: pageable.pageSize ?? 10,
              total: response.data.totalElements ?? content.length,
              has_more: !response.data.last
            }
          };
        }
        return {
          agents: content,
          pagination: response.data?.pagination ?? { current_page: 1, last_page: 1, per_page: 10, total: content.length, has_more: false }
        };
      })
    );
  }

  searchAgents(params?: {
    specialization?: string;
    transport?: string;
    min_price?: number;
    max_price?: number;
    q?: string;
    region_id?: number;
  }): Observable<Agent[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.specialization) queryParams.append('specialization', params.specialization);
      if (params.transport) queryParams.append('transport', params.transport);
      if (params.min_price !== undefined) queryParams.append('min_price', params.min_price.toString());
      if (params.max_price !== undefined) queryParams.append('max_price', params.max_price.toString());
      if (params.q) queryParams.append('q', params.q);
      if (params.region_id) queryParams.append('region_id', params.region_id.toString());
    }
    const queryString = queryParams.toString();
    const endpoint = queryString ? `agents/search?${queryString}` : 'agents/search';
    return this.api.get<{ data: Agent[] }>(endpoint).pipe(
      map(response => response.data)
    );
  }

  getPublicAgentProfile(userId: number): Observable<Agent> {
    return this.api.get<{ data: Agent }>(`agents/${userId}/public`).pipe(
      map(response => response.data)
    );
  }
}
