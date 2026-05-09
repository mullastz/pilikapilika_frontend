import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AgentGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    const user = this.authService.getUser();
    
    if (!user) {
      this.router.navigate(['/sign-in']);
      return false;
    }

    if (user.role !== 'agent') {
      this.router.navigate(['/home']);
      return false;
    }

    return true;
  }
}
