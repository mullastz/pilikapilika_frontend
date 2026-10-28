import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { App } from './app';
import { AuthService } from './core/services/auth.service';

@Component({ template: '<h1>Public page</h1>' })
class PublicPage {}

describe('App', () => {
  it('starts SEO handling and renders the routed public page', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [
      provideRouter([{ path: '', component: PublicPage }]),
      { provide: AuthService, useValue: { isAuthenticated: () => false, getUser: () => null } },
    ] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Public page');
    expect(TestBed.inject(Title).getTitle()).toContain('Logistics & Delivery Agents');
  });
});
