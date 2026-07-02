import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProfileCompletionService } from '../services/profile-completion.service';

/**
 * ProfileCompletionGuard - Ensures users have completed their BASIC profile before
 * accessing protected routes.
 *
 * This guard checks if the authenticated user has filled in the essential profile
 * fields (firstname, lastname, phone, region, district). It does NOT require
 * agent-specific fields (pricing, bio, etc.) — those can be added later.
 *
 * The guard allows access to:
 * - The profile completion page itself (/account/details)
 * - The sign-out flow
 * - Public routes (handled by other guards)
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileCompletionGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private profileService: ProfileCompletionService,
    private router: Router
  ) {}

  canActivate(): boolean | UrlTree {
    const user = this.authService.getUser();

    // If not authenticated, let other guards/auth interceptors handle it
    if (!user) {
      return true;
    }

    // Check basic profile completion (essential fields only)
    // Agent-specific fields (pricing, bio, etc.) are NOT required here
    const basicFields = ['firstname', 'lastname', 'phone', 'region', 'district'];
    const missingBasicFields = basicFields.filter(field => {
      const value = (user as any)[field];
      return !value || value === '' || value === null;
    });

    if (missingBasicFields.length > 0) {
      // Redirect to profile completion page
      return this.router.createUrlTree(['/account/details'], {
        queryParams: { reason: 'incomplete_profile' }
      });
    }

    return true;
  }
}
