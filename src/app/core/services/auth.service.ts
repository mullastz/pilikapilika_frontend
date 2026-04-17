import { Injectable } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  User
} from '../interfaces/auth.interface';

/**
 * AuthService - Handles authentication operations only
 * (Login, Logout, Register, Token management)
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private api: ApiService) {}

  /**
   * Register a new user
   */
  signup(data: SignupRequest): Observable<SignupResponse> {
    return this.api.post<SignupResponse>('register', data).pipe(
      tap(response => {
        // Don't save token on registration - user needs to verify email first
        if (response.data?.user) {
          // Store minimal user info for verification purposes
          localStorage.setItem('pending_verification_email', response.data.user.email);
        }
      })
    );
  }

  /**
   * Login user
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('login', credentials).pipe(
      tap(response => {
        if (response.token) {
          this.saveToken(response.token);
        }
        if (response.data) {
          this.saveUser(response.data);
        }
        // Store profile completion status
        if (response.profile) {
          localStorage.setItem('profile_completion', JSON.stringify(response.profile));
        }
      })
    );
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('profile_completion');
  }

  // ========== Token & User Storage ==========

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

  // ========== Profile Completion Helpers ==========

  getProfileCompletionStatus(): { is_complete: boolean; missing_fields: string[] } | null {
    const status = localStorage.getItem('profile_completion');
    return status ? JSON.parse(status) : null;
  }

  setProfileComplete(): void {
    localStorage.setItem('profile_completion', JSON.stringify({ is_complete: true, missing_fields: [] }));
  }

  needsProfileCompletion(): boolean {
    const status = this.getProfileCompletionStatus();
    return status ? !status.is_complete : false;
  }

  // ========== Pending Verification Helpers ==========

  getPendingVerificationEmail(): string | null {
    return localStorage.getItem('pending_verification_email');
  }

  clearPendingVerification(): void {
    localStorage.removeItem('pending_verification_email');
  }

  // ========== Password Reset ==========

  /**
   * Request password reset email
   */
  forgotPassword(email: string): Observable<any> {
    return this.api.post('forgot-password', { email });
  }

  /**
   * Verify reset token is valid
   */
  verifyResetToken(uuid: string, token: string): Observable<any> {
    return this.api.get(`reset-password/${uuid}/verify?token=${token}`);
  }

  /**
   * Reset password with token
   */
  resetPassword(data: { uuid: string; token: string; password: string; password_confirmation: string }): Observable<any> {
    return this.api.post('reset-password', data);
  }
}
