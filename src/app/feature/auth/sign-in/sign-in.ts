import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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

  constructor(private fb: FormBuilder, private router: Router) {
    this.signInForm = this.fb.group({
      phone: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
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

    // TODO: Call your auth service here
    console.log('Sign In Payload:', this.signInForm.value);

    setTimeout(() => {
      this.isLoading.set(false);
      // this.router.navigate(['/dashboard']);
      alert('Sign In Successful! (Demo)');
    }, 1500);
  }

  goBack() {
    window.history.back();
  }
}
