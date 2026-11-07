import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/sign-in']);
  return auth.getUser()?.is_agency_staff ? true : router.createUrlTree(['/home']);
};

export const staffBoundaryGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated() || !auth.getUser()?.is_agency_staff) return true;
  return state.url.startsWith('/staff/') || state.url.startsWith('/sign-in')
    ? true : router.createUrlTree(['/staff/tasks']);
};
