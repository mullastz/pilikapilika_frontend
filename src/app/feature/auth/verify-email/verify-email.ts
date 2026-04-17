import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VerificationService } from '../../../core/services/verification.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-verify-email',
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css',
})
export class VerifyEmail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private verificationService = inject(VerificationService);
  private toastService = inject(ToastService);

  email = signal<string>('');
  uuid = signal<string>('');
  token = signal<string>('');
  isLoading = signal(false);
  isVerifying = signal(false);
  isVerified = signal(false);
  errorMessage = signal<string>('');

  ngOnInit(): void {
    // Get uuid from route path params
    this.route.params.subscribe(params => {
      this.uuid.set(params['uuid'] || '');
    });

    // Get email and token from query params
    this.route.queryParams.subscribe(params => {
      this.email.set(params['email'] || '');
      this.token.set(params['token'] || '');

      // If token is provided in URL, verify immediately
      if (this.token() && this.uuid()) {
        this.verifyEmail();
      }
    });
  }

  resendEmail(): void {
    if (!this.email()) {
      this.toastService.error('Email address is required');
      return;
    }

    this.isLoading.set(true);
    this.verificationService.resendVerification(this.email()).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.toastService.success(response.message || 'Verification email sent!');
        if (response.data?.uuid) {
          this.uuid.set(response.data.uuid);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const message = err.error?.message || 'Failed to send verification email';
        this.toastService.error(message);
      }
    });
  }

  verifyEmail(): void {
    if (!this.uuid() || !this.token()) {
      this.errorMessage.set('Invalid verification link');
      return;
    }

    this.isVerifying.set(true);
    this.verificationService.verifyEmail({
      uuid: this.uuid(),
      token: this.token()
    }).subscribe({
      next: (response) => {
        this.isVerifying.set(false);
        this.isVerified.set(true);
        this.toastService.success(response.message || 'Email verified successfully!');
      },
      error: (err) => {
        this.isVerifying.set(false);
        this.errorMessage.set(err.error?.message || 'Verification failed');
        this.toastService.error(this.errorMessage());
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/sign-in']);
  }
}
