import { Routes } from '@angular/router';
import { ProfileCompletionGuard } from './core/guards/profile-completion.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { AgentGuard } from './core/guards/agent.guard';


export const routes: Routes = [
  { path: 'sign-up', loadComponent: () => import('./feature/auth/sign-up/sign-up').then(m => m.SignUp) },
  { path: 'sign-in', loadComponent: () => import('./feature/auth/sign-in/sign-in').then(m => m.SignIn) },
  { path: 'verify-email/:uuid', loadComponent: () => import('./feature/auth/verify-email/verify-email').then(m => m.VerifyEmail) },
  { path: 'forgot-password', loadComponent: () => import('./feature/auth/forgot-password/forgot-password').then(m => m.ForgotPassword) },
  { path: 'reset-password/:uuid', loadComponent: () => import('./feature/auth/reset-password/reset-password').then(m => m.ResetPassword) },
  { path: '', loadComponent: () => import('./feature/landing-page/landing-page').then(m => m.LandingPage) },
  { path: 'about-us', loadComponent: () => import('./feature/about-us/about-us').then(m => m.AboutUs) },
  { path: 'how-it-works', loadComponent: () => import('./feature/how-it-works/how-it-works').then(m => m.HowItWorks) },
  { path: 'contact-us', loadComponent: () => import('./feature/contact-us/contact-us').then(m => m.ContactUs) },
  { path: 'home', loadComponent: () => import('./feature/home/home').then(m => m.Home), canActivate: [ProfileCompletionGuard] },
  { path: 'profile-management', loadComponent: () => import('./feature/profile-management/profile-management').then(m => m.ProfileManagement), canActivate: [ProfileCompletionGuard] },
  { path: 'account/details', loadComponent: () => import('./feature/manage-account/manage-account').then(m => m.ManageAccount) },
  { path: 'account/agent', loadComponent: () => import('./feature/agent-details/agent-details').then(m => m.AgentDetails), canActivate: [AgentGuard] },
  { path: 'account/shipping', loadComponent: () => import('./feature/shipping/shipping').then(m => m.Shipping), canActivate: [ProfileCompletionGuard] },
  { path: 'account/help', loadComponent: () => import('./feature/help-center/help-center').then(m => m.HelpCenter), canActivate: [ProfileCompletionGuard] },
  { path: 'agent/:id', loadComponent: () => import('./feature/agent-page/agent-page').then(m => m.AgentPage), canActivate: [ProfileCompletionGuard] },
  { path: 'track-shipping/:id', loadComponent: () => import('./feature/track-shipping/track-shipping').then(m => m.TrackShipping), canActivate: [ProfileCompletionGuard] },
  { path: 'messages', loadComponent: () => import('./feature/messages/messages').then(m => m.Messages), canActivate: [ProfileCompletionGuard] },
  { path: 'search', loadComponent: () => import('./feature/search/search').then(m => m.Search) },
  { path: 'qr-generator', loadComponent: () => import('./feature/qr-generator/qr-generator').then(m => m.QrGenerator), canActivate: [ProfileCompletionGuard] },
  { path: 'qr/:uuid', loadComponent: () => import('./feature/qr-view/qr-view').then(m => m.QrView), canActivate: [ProfileCompletionGuard] },
  { path: 'package-generator', loadComponent: () => import('./feature/package-generator/package-generator').then(m => m.PackageGenerator), canActivate: [ProfileCompletionGuard] },
  { path: 'package/:uuid', loadComponent: () => import('./feature/package-view/package-view').then(m => m.PackageView), canActivate: [ProfileCompletionGuard] },
  { path: 'book-shipment/:agentId', loadComponent: () => import('./feature/book-shipment/book-shipment').then(m => m.BookShipment), canActivate: [ProfileCompletionGuard] },
  { path: 'account/my-products', loadComponent: () => import('./feature/my-products/my-products').then(m => m.MyProducts), canActivate: [ProfileCompletionGuard] },
  { path: 'scan-qr', loadComponent: () => import('./feature/scan-qr/scan-qr').then(m => m.ScanQr), canActivate: [AgentGuard] },
  { path: 'account/scan-qr', loadComponent: () => import('./feature/scan-qr/scan-qr').then(m => m.ScanQr), canActivate: [AgentGuard] },

  // Admin Routes
  {
    path: 'admin',
    loadComponent: () => import('./feature/admin/layout/layout').then(m => m.AdminLayout),
    canActivate: [AdminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./feature/admin/dashboard/dashboard').then(m => m.AdminDashboard) },
      { path: 'users', loadComponent: () => import('./feature/admin/users/users').then(m => m.AdminUsers) },
      { path: 'agents', loadComponent: () => import('./feature/admin/agents/agents').then(m => m.AdminAgents) },
      { path: 'shipments', loadComponent: () => import('./feature/admin/shipments/shipments').then(m => m.AdminShipments) },
      { path: 'containers', loadComponent: () => import('./feature/admin/containers/containers').then(m => m.AdminContainers) },
      { path: 'packages', loadComponent: () => import('./feature/admin/packages/packages').then(m => m.AdminPackages) },
      { path: 'addresses', loadComponent: () => import('./feature/admin/addresses/addresses').then(m => m.AdminAddresses) },
      { path: 'qr-codes', loadComponent: () => import('./feature/admin/qr-codes/qr-codes').then(m => m.AdminQrCodes) },
      { path: 'reviews', loadComponent: () => import('./feature/admin/reviews/reviews').then(m => m.AdminReviews) },
      { path: 'payments', loadComponent: () => import('./feature/admin/payments/payments').then(m => m.AdminPayments) },
      { path: 'verifications', loadComponent: () => import('./feature/admin/verifications/verifications').then(m => m.AdminVerifications) },
      { path: 'reset-tokens', loadComponent: () => import('./feature/admin/reset-tokens/reset-tokens').then(m => m.AdminResetTokens) },
      { path: 'user-keys', loadComponent: () => import('./feature/admin/user-keys/user-keys').then(m => m.AdminUserKeys) },
      { path: 'regions', loadComponent: () => import('./feature/admin/regions/regions').then(m => m.AdminRegions) },
      { path: 'settings', loadComponent: () => import('./feature/admin/settings/settings').then(m => m.AdminSettings) },
      { path: 'account', loadComponent: () => import('./feature/admin/account/account').then(m => m.AdminAccount) },
      { path: 'messages', loadComponent: () => import('./feature/admin/messages/messages').then(m => m.AdminMessages) },
      { path: 'logs', loadComponent: () => import('./feature/admin/logs/logs').then(m => m.AdminLogs) },
    ]
  },

];
