import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile-management',
  imports: [],
  templateUrl: './profile-management.html',
  styleUrl: './profile-management.css',
})
export class ProfileManagement {
  constructor(private location: Location,private router: Router) {}

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      // fallback route (example: home)
      // inject Router if needed
    }
  }

  goTo(page: string) {
    this.router.navigate([`/account/${page}`]);
  }
}
