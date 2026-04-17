import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  EmailVerificationRequest,
  EmailVerificationResponse,
  VerifyEmailParams,
  VerifyEmailResponse
} from '../interfaces/auth.interface';

/**
 * VerificationService - Handles email verification operations
 * (Send verification, Verify email, Resend verification)
 */
@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  constructor(private api: ApiService) {}

  /**
   * Send email verification link
   */
  sendVerificationEmail(email: string): Observable<EmailVerificationResponse> {
    return this.api.post<EmailVerificationResponse>('send-verification-email', { email }).pipe(
      tap(response => {
        if (response.data?.uuid) {
          localStorage.setItem('verification_uuid', response.data.uuid);
        }
      })
    );
  }

  /**
   * Verify email with token
   */
  verifyEmail(params: VerifyEmailParams): Observable<VerifyEmailResponse> {
    return this.api.get<VerifyEmailResponse>(`verify-email/${params.uuid}?token=${params.token}`).pipe(
      tap(() => {
        // Clear pending verification after successful verification
        localStorage.removeItem('pending_verification_email');
        localStorage.removeItem('verification_uuid');
      })
    );
  }

  /**
   * Resend verification email
   */
  resendVerification(email: string): Observable<EmailVerificationResponse> {
    return this.api.post<EmailVerificationResponse>('resend-verification', { email });
  }

  /**
   * Get stored verification UUID
   */
  getStoredVerificationUuid(): string | null {
    return localStorage.getItem('verification_uuid');
  }

  /**
   * Clear verification data
   */
  clearVerificationData(): void {
    localStorage.removeItem('pending_verification_email');
    localStorage.removeItem('verification_uuid');
  }
}
