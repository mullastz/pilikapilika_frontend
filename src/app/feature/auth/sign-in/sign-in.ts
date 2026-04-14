import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-sign-in',
  imports: [ CommonModule, ReactiveFormsModule, RouterLink ],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
})
export class SignIn {
  signInForm: FormGroup;
  isLoading = signal(false);
  showPassword = signal(false);

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  constructor() {
    this.signInForm = this.fb.group({
      login: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  get f() {
    return this.signInForm.controls;
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  onSubmit() {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    const loginData = {
      login: this.signInForm.value.login,
      password: this.signInForm.value.password
    };

    this.authService.login(loginData).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.toastService.success('Welcome back! Login successful.');
        // Navigate to landing page
        this.router.navigate(['/']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const errorMsg = this.extractErrorMessage(err);
        this.toastService.error(errorMsg);
      }
    });
  }

  goBack() {
    window.history.back();
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    // Laravel validation errors (422 status with errors object)
    if (err.error?.errors) {
      // Get first error from any field (login, email, etc.)
      const errorKeys = Object.keys(err.error.errors);
      for (const key of errorKeys) {
        const messages = err.error.errors[key];
        if (Array.isArray(messages) && messages.length > 0) {
          return messages[0];
        }
      }
    }

    // Laravel message field (generic message)
    if (err.error?.message && err.error.message !== 'The given data was invalid.') {
      return err.error.message;
    }

    // Check for specific error indicators in the error object
    const errorStr = JSON.stringify(err.error).toLowerCase();
    if (errorStr.includes('not approved') || errorStr.includes('not yet approved')) {
      return 'Your account is not yet approved. Please contact System Administrator.';
    }
    if (errorStr.includes('password is incorrect')) {
      return 'The provided password is incorrect.';
    }
    if (errorStr.includes('credentials do not match')) {
      return 'The provided credentials do not match our records.';
    }

    // HTTP status based fallbacks
    if (err.status === 422) {
      return 'Invalid login credentials. Please check your email/username and password.';
    }

    if (err.status === 401) {
      return 'Invalid credentials. Please check your email/username and password.';
    }

    if (err.status === 403) {
      return 'Your account is not approved yet. Please contact the administrator.';
    }

    if (err.status === 0) {
      return 'Cannot connect to server. Please check your internet connection.';
    }

    return 'Login failed. Please try again later.';
  }
}
