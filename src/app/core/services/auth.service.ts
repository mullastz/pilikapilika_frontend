import { Injectable } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  User,
  Region,
  District,
  UpdateProfileRequest,
  UpdateProfileResponse
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
}
