import { Component, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-sign-up',
  imports: [ CommonModule, ReactiveFormsModule, RouterLink ],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.css',
})
export class SignUp {
 signupForm: FormGroup;
  isLoading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  constructor(private fb: FormBuilder, private router: Router, private location: Location) {
    this.signupForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)]], // basic E.164-ish
      location: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      userType: ['client', Validators.required], // default to client
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

    // TODO: call auth service / API here
    console.log('Signup payload:', this.signupForm.value);

    // Simulate API delay
    setTimeout(() => {
      this.isLoading.set(false);
      // Navigate to dashboard or verify page
      // this.router.navigate(['/dashboard']);
      alert('Signup successful! (demo)');
    }, 1500);
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
}