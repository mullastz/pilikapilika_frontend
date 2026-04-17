import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss']
})
export class ResetPassword implements OnInit {
  resetForm: FormGroup;
  isLoading = signal(false);
  isVerifying = signal(true);
  tokenValid = signal(false);
  resetSuccess = signal(false);
  email = signal('');
  uuid = '';
  token = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Get uuid from route params and token from query params
    this.route.params.subscribe(params => {
      this.uuid = params['uuid'] || '';
    });

    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      this.verifyToken();
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirm = form.get('password_confirmation');
    if (password && confirm && password.value !== confirm.value) {
      confirm.setErrors({ passwordMismatch: true });
    } else {
      if (confirm?.errors?.['passwordMismatch']) {
        const errors = { ...confirm.errors };
        delete errors['passwordMismatch'];
        confirm.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }
  }

  verifyToken(): void {
    if (!this.uuid || !this.token) {
      this.isVerifying.set(false);
      this.tokenValid.set(false);
      this.toastService.error('Invalid reset link. Please request a new one.');
      return;
    }

    this.authService.verifyResetToken(this.uuid, this.token).subscribe({
      next: (response) => {
        this.isVerifying.set(false);
        this.tokenValid.set(true);
        this.email.set(response.data?.email || '');
      },
      error: (err) => {
        this.isVerifying.set(false);
        this.tokenValid.set(false);
        const errorMsg = err.error?.message || 'Invalid or expired reset link.';
        this.toastService.error(errorMsg);
      }
    });
  }

  get password() {
    return this.resetForm.get('password');
  }

  get passwordConfirmation() {
    return this.resetForm.get('password_confirmation');
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    const data = {
      uuid: this.uuid,
      token: this.token,
      password: this.password?.value,
      password_confirmation: this.passwordConfirmation?.value
    };

    this.authService.resetPassword(data).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.resetSuccess.set(true);
        this.toastService.success('Password reset successful! You can now log in with your new password.');
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err.error?.message || 'Failed to reset password. Please try again.';
        this.toastService.error(errorMsg);
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/sign-in']);
  }

  requestNewLink(): void {
    this.router.navigate(['/forgot-password']);
  }
}
