import { Injectable } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  User,
  Agent,
  AgentProfile,
  Region,
  District,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateAgentProfileRequest,
  AgentProfileResponse
} from '../interfaces/auth.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private api: ApiService) {}

  signup(data: SignupRequest): Observable<SignupResponse> {
    return this.api.post<SignupResponse>('register', data).pipe(
      tap(response => {
        if (response.data) {
          this.saveUser(response.data);
        }
      })
    );
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('login', credentials).pipe(
      tap(response => {
        if (response.token) {
          this.saveToken(response.token);
        }
        if (response.data) {
          this.saveUser(response.data);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  // Region & District APIs
  getRegions(): Observable<Region[]> {
    return this.api.get<{ success: boolean; data: Region[] }>('regions').pipe(
      map(response => response.data)
    );
  }

  getDistrictsByRegion(regionId: number): Observable<District[]> {
    return this.api.get<{ success: boolean; data: { region: string; districts: District[] } }>(`regions/${regionId}/districts`).pipe(
      map(response => response.data.districts)
    );
  }

  getAllDistricts(): Observable<District[]> {
    return this.api.get<{ success: boolean; data: District[] }>('districts').pipe(
      map(response => response.data)
    );
  }

  // Storage helpers
  saveToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  saveUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  }

  getUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Profile management
  getProfile(): Observable<User> {
    return this.api.get<{ data: User }>('me').pipe(
      map(response => response.data),
      tap(user => {
        this.saveUser(user);
      })
    );
  }

  updateProfile(data: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    return this.api.put<UpdateProfileResponse>('me', data).pipe(
      tap(response => {
        if (response.data) {
          this.saveUser(response.data);
        }
      })
    );
  }

  // Password management
  changePassword(data: { current_password: string; new_password: string; new_password_confirmation: string }): Observable<{ message: string; data: User }> {
    return this.api.post<{ message: string; data: User }>('change-password', data);
  }

  // Agent profile management (authenticated)
  getAgentProfile(userId: number): Observable<Agent> {
    return this.api.get<{ data: Agent }>(`agents/${userId}/profile`).pipe(
      map(response => response.data),
      tap(agent => {
        // Save merged agent data to localStorage
        this.saveUser(agent);
      })
    );
  }

  updateAgentProfile(userId: number, data: UpdateAgentProfileRequest): Observable<AgentProfileResponse> {
    return this.api.put<AgentProfileResponse>(`agents/${userId}/profile`, data);
  }

  // Public agent discovery (no authentication required)
  getAvailableAgents(): Observable<Agent[]> {
    return this.api.get<{ data: Agent[] }>('agents').pipe(
      map(response => response.data)
    );
  }

  searchAgents(params?: { specialization?: string; transport?: string; min_price?: number; max_price?: number; q?: string }): Observable<Agent[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.specialization) queryParams.append('specialization', params.specialization);
      if (params.transport) queryParams.append('transport', params.transport);
      if (params.min_price !== undefined) queryParams.append('min_price', params.min_price.toString());
      if (params.max_price !== undefined) queryParams.append('max_price', params.max_price.toString());
      if (params.q) queryParams.append('q', params.q);
    }
    const queryString = queryParams.toString();
    const endpoint = queryString ? `agents/search?${queryString}` : 'agents/search';
    return this.api.get<{ data: Agent[] }>(endpoint).pipe(
      map(response => response.data)
    );
  }

  getPublicAgentProfile(userId: number): Observable<Agent> {
    console.log('Fetching public agent profile for ID:', userId);
    return this.api.get<{ data: Agent }>(`agents/${userId}/public`).pipe(
      map(response => {
        console.log('Public agent profile response:', response);
        return response.data;
      })
    );
  }
}
