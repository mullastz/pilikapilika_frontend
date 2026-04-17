import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPassword {
  forgotForm: FormGroup;
  isLoading = signal(false);
  emailSent = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get email() {
    return this.forgotForm.get('email');
  }

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    this.authService.forgotPassword(this.email?.value).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.emailSent.set(true);
        this.toastService.success('Password reset email sent! Please check your inbox.');
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err.error?.message || 'Failed to send reset email. Please try again.';
        this.toastService.error(errorMsg);
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/sign-in']);
  }
}
