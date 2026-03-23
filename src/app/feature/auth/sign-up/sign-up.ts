import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sign-up',
  imports: [  ],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.css',
})
export class SignUp {
  constructor(private router: Router) {}

  goToSignIn() {
    this.router.navigate(['/sign-in']);   // adjust route as needed
  }
}
