import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const router = inject(Router);

  // Get token from localStorage
  const token = localStorage.getItem('auth_token');

  // Check if this is a public QR code endpoint
  const isPublicQrEndpoint = req.url.includes('/qr-codes/') && req.method === 'GET';

  // Clone request and add auth header if token exists and not a public QR endpoint
  if (token && !isPublicQrEndpoint) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
  } else {
    req = req.clone({
      setHeaders: {
        Accept: 'application/json'
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        router.navigate(['/sign-in']);
      }
      return throwError(() => error);
    })
  );
};
