import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AgencyService, AgencyStage } from '../../core/services/agency.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-staff-invitation',
  imports: [FormsModule, RouterLink],
  template: `
<main class="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] flex items-center justify-center px-4 py-8 sm:py-12 text-gray-900 dark:text-white">
  <div class="w-full max-w-md">
    <header class="text-center mb-8">
      <a routerLink="/" class="inline-block text-3xl font-lobster font-bold text-[#FF7800] mb-6">Pilika Pilika</a>
      <div class="flex items-center justify-center w-16 h-16 rounded-full bg-[#FF7800] text-white mx-auto mb-4">
        <i class="fa-solid fa-user-plus text-2xl" aria-hidden="true"></i>
      </div>
      <h1 class="text-2xl font-bold">Staff Invitation</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">Set up your account to join your agency.</p>
    </header>

    <section class="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-lg p-6 sm:p-8" aria-label="Accept your staff invitation">
      @if (loading()) {
        <div role="status" class="text-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF7800] mx-auto mb-4" aria-hidden="true"></div>
          <p class="text-gray-600 dark:text-gray-400">Checking your invitation...</p>
        </div>
      } @else if (invitation(); as invite) {
        <div class="mb-6">
          <h2 class="text-xl font-semibold wrap-anywhere">Join {{ invite.agency_name }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Hello {{ invite.firstname }}. Create a password to access your assigned shipment tasks.</p>
        </div>

        <div class="mb-5 p-4 bg-gray-100 dark:bg-[#111] rounded-xl">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-1"><i class="fa-solid fa-envelope text-orange-500 mr-2" aria-hidden="true"></i>Your sign-in email</p>
          <p class="font-medium wrap-anywhere">{{ invite.email }}</p>
          @if (invite.job_title) {
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 wrap-anywhere">{{ invite.job_title }}</p>
          }
        </div>

        @if (invite.stages.length) {
          <details class="group mb-6 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <summary class="flex items-center justify-between gap-2 list-none cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg [&::-webkit-details-marker]:hidden">
              <span>Assigned responsibilities ({{ invite.stages.length }})</span>
              <i class="fa-solid fa-chevron-down text-gray-500 text-xs transition-transform group-open:rotate-180" aria-hidden="true"></i>
            </summary>
            <div class="flex flex-wrap gap-2 mt-3">
              @for (stage of invite.stages; track stage.status) {
                <span class="text-xs bg-gray-100 dark:bg-[#333] text-gray-700 dark:text-gray-300 rounded-lg px-3 py-2">{{ stage.label }}</span>
              }
            </div>
          </details>
        }

        <form #acceptForm="ngForm" (ngSubmit)="accept(acceptForm)" novalidate>
          <fieldset [disabled]="saving()" class="space-y-5">
            <div>
              <label for="staff-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
              <div class="relative">
                <input id="staff-password" name="password" #passwordField="ngModel" [(ngModel)]="password"
                       [type]="showPassword() ? 'text' : 'password'" required minlength="8" maxlength="128" autocomplete="new-password"
                       placeholder="Enter your new password" aria-describedby="staff-password-hint"
                       [attr.aria-invalid]="passwordField.invalid && (passwordField.touched || acceptForm.submitted)"
                       [class.ring-2]="passwordField.invalid && (passwordField.touched || acceptForm.submitted)"
                       [class.ring-red-500]="passwordField.invalid && (passwordField.touched || acceptForm.submitted)"
                       class="w-full p-3 pr-12 rounded-xl bg-gray-100 dark:bg-[#111] dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                <button type="button" (click)="showPassword.set(!showPassword())"
                        [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPassword()"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <i class="fa-solid" [class.fa-eye]="!showPassword()" [class.fa-eye-slash]="showPassword()" aria-hidden="true"></i>
                </button>
              </div>
              <p id="staff-password-hint" class="text-xs text-gray-500 dark:text-gray-400 mt-2">Use at least 8 characters.</p>
              @if (passwordField.invalid && (passwordField.touched || acceptForm.submitted)) {
                <p class="text-red-500 text-sm mt-1" role="alert">{{ passwordField.errors?.['required'] ? 'Password is required.' : 'Password must contain between 8 and 128 characters.' }}</p>
              }
            </div>

            <div>
              <label for="staff-confirmation" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
              <div class="relative">
                <input id="staff-confirmation" name="confirmation" #confirmationField="ngModel" [(ngModel)]="confirmation"
                       [type]="showConfirmation() ? 'text' : 'password'" required maxlength="128" autocomplete="new-password"
                       placeholder="Confirm your new password"
                       [attr.aria-invalid]="(confirmationField.invalid || password !== confirmation) && (confirmationField.touched || acceptForm.submitted)"
                       [class.ring-2]="(confirmationField.invalid || password !== confirmation) && (confirmationField.touched || acceptForm.submitted)"
                       [class.ring-red-500]="(confirmationField.invalid || password !== confirmation) && (confirmationField.touched || acceptForm.submitted)"
                       class="w-full p-3 pr-12 rounded-xl bg-gray-100 dark:bg-[#111] dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                <button type="button" (click)="showConfirmation.set(!showConfirmation())"
                        [attr.aria-label]="showConfirmation() ? 'Hide password confirmation' : 'Show password confirmation'" [attr.aria-pressed]="showConfirmation()"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <i class="fa-solid" [class.fa-eye]="!showConfirmation()" [class.fa-eye-slash]="showConfirmation()" aria-hidden="true"></i>
                </button>
              </div>
              @if (confirmationField.touched || acceptForm.submitted) {
                @if (confirmationField.errors?.['required']) {
                  <p class="text-red-500 text-sm mt-1" role="alert">Please confirm your password.</p>
                } @else if (password !== confirmation) {
                  <p class="text-red-500 text-sm mt-1" role="alert">Passwords do not match.</p>
                }
              }
            </div>

            @if (error()) {
              <p role="alert" class="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">{{ error() }}</p>
            }

            <button type="submit" [disabled]="saving()"
                    class="w-full bg-[#FF7800] text-white py-3 px-6 rounded-full font-semibold hover:bg-orange-600 transition-all shadow flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed">
              @if (saving()) { <span class="animate-spin rounded-full h-4 w-4 border-b-2 border-white" aria-hidden="true"></span> }
              {{ saving() ? 'Activating...' : 'Accept Invitation' }}
            </button>
          </fieldset>
        </form>
      } @else {
        <div class="text-center py-4">
          <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fa-solid fa-link-slash text-2xl text-red-600 dark:text-red-400" aria-hidden="true"></i>
          </div>
          <h2 class="text-xl font-semibold mb-2">Invitation Unavailable</h2>
          <p role="alert" class="text-gray-600 dark:text-gray-400 mb-6">{{ error() }}</p>
          <a routerLink="/sign-in" class="w-full inline-flex items-center justify-center bg-[#FF7800] text-white py-3 px-6 rounded-full font-semibold hover:bg-orange-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1a1a]">Go to Sign In</a>
        </div>
      }
    </section>

    @if (invitation()) {
      <p class="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">
        Already accepted your invitation?
        <a routerLink="/sign-in" class="text-[#FF7800] hover:text-orange-600 font-medium">Sign in</a>
      </p>
    }
  </div>
</main>
`,
})
export class StaffInvitation implements OnInit {
  private readonly api = inject(AgencyService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmation = signal(false);
  readonly error = signal('');
  readonly invitation = signal<{ firstname: string; email: string; agency_name: string; job_title: string | null; stages: AgencyStage[] } | null>(null);
  password = ''; confirmation = '';
  private id = ''; private token = '';
  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.id || !this.token) { this.error.set('This invitation link is incomplete. Ask the agency owner for a new invitation.'); this.loading.set(false); return; }
    this.api.invitation(this.id, this.token).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({
      next: response => this.invitation.set(response.data),
      error: error => this.error.set(error.error?.message || 'Unable to open this invitation. Ask the agency owner for a new link.'),
    });
  }
  accept(form: NgForm): void {
    if (this.saving() || !this.invitation()) return;
    this.error.set('');
    if (form.invalid || this.password !== this.confirmation) {
      form.control.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.accept(this.id, this.token, this.password, this.confirmation).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.auth.logout();
        this.toast.success('Invitation accepted. Sign in with your staff email and new password.');
        this.router.navigate(['/sign-in'], { replaceUrl: true });
      },
      error: error => this.error.set(error.error?.message || 'Unable to accept this invitation. Please try again.'),
    });
  }
}
