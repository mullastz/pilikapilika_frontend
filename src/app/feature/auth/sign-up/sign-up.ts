import { Component, signal, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { SignupRequest } from '../../../core/interfaces/auth.interface';

/**
 * Simplified Sign Up Component
 * Only requires: username, email, password, and role
 * Other profile fields can be filled after registration
 */
@Component({
  selector: 'app-sign-up',
  imports: [ CommonModule, ReactiveFormsModule, RouterLink ],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.css',
})
export class SignUp {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private location = inject(Location);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  signupForm: FormGroup;
  isLoading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  constructor() {
    this.signupForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      userType: ['client', Validators.required], // client = Buyer, agent = Seller
    }, { validators: this.passwordMatchValidator });
  }

  // Custom validator: passwords must match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirm = form.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  get f() {
    return this.signupForm.controls;
  }

  onSubmit() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    const formValue = this.signupForm.value;
    const signupData: SignupRequest = {
      username: formValue.username,
      email: formValue.email,
      password: formValue.password,
      password_confirmation: formValue.confirmPassword,
      role: formValue.userType === 'agent' ? 'Seller' : 'Buyer'
    };

    this.authService.signup(signupData).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        // Show success toast
        this.toastService.success('Registration successful! Please check your email to verify your account.');
        // Navigate to email verification page with UUID in path
        this.router.navigate(['/verify-email', response.data?.uuid], {
          queryParams: {
            email: response.data?.user?.email
          }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const errorMsg = this.extractErrorMessage(err);
        this.toastService.error(errorMsg);
        console.error('Signup error:', err);
      }
    });
  }

  goBack() {
    this.location.back();
  }

  togglePasswordVisibility(field: 'password' | 'confirm') {
    if (field === 'password') {
      this.showPassword.update(v => !v);
    } else {
      this.showConfirmPassword.update(v => !v);
    }
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    // Laravel validation errors (422 status with errors object)
    if (err.error?.errors) {
      // Get first error from any field
      const errorKeys = Object.keys(err.error.errors);
      for (const key of errorKeys) {
        const messages = err.error.errors[key];
        if (Array.isArray(messages) && messages.length > 0) {
          return messages[0];
        }
      }
    }

    // Laravel message field
    if (err.error?.message && err.error.message !== 'The given data was invalid.') {
      return err.error.message;
    }

    // Check for specific error indicators in the error object
    const errorStr = JSON.stringify(err.error).toLowerCase();
    if (errorStr.includes('email') && errorStr.includes('taken')) {
      return 'This email address is already registered.';
    }
    if (errorStr.includes('username') && errorStr.includes('taken')) {
      return 'This username is already taken.';
    }
    if (errorStr.includes('phone') && errorStr.includes('taken')) {
      return 'This phone number is already registered.';
    }

    // HTTP status based messages
    if (err.status === 422) {
      return 'Please check your information and try again.';
    }

    if (err.status === 409) {
      return 'An account with this email or username already exists.';
    }

    if (err.status === 0) {
      return 'Cannot connect to server. Please check your internet connection.';
    }

    return 'Signup failed. Please try again later.';
  }
}