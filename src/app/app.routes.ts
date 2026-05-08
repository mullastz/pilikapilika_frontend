import { Routes } from '@angular/router';
import { SignUp } from './feature/auth/sign-up/sign-up';
import { SignIn } from './feature/auth/sign-in/sign-in';
import { VerifyEmail } from './feature/auth/verify-email/verify-email';
import { ForgotPassword } from './feature/auth/forgot-password/forgot-password';
import { ResetPassword } from './feature/auth/reset-password/reset-password';
import { LandingPage } from './feature/landing-page/landing-page';
import { ProfileManagement } from './feature/profile-management/profile-management';
import { ManageAccount } from './feature/manage-account/manage-account';
import { Shipping } from './feature/shipping/shipping';
import { History } from './feature/history/history';
import { HelpCenter } from './feature/help-center/help-center';
import { AgentPage } from './feature/agent-page/agent-page';
import { TrackShipping } from './feature/track-shipping/track-shipping';
import { AgentDetails } from './feature/agent-details/agent-details';
import { Messages } from './feature/messages/messages';
import { Search } from './feature/search/search';
import { QrGenerator } from './feature/qr-generator/qr-generator';
import { QrView } from './feature/qr-view/qr-view';
import { MyProducts } from './feature/my-products/my-products';
import { PackageGenerator } from './feature/package-generator/package-generator';
import { PackageView } from './feature/package-view/package-view';
import { Home } from './feature/home/home';
import { AdminGuard } from './core/guards/admin.guard';
import { AdminLayout } from './feature/admin/layout/layout';
import { AdminDashboard } from './feature/admin/dashboard/dashboard';
import { AdminUsers } from './feature/admin/users/users';
import { AdminAgents } from './feature/admin/agents/agents';
import { AdminShipments } from './feature/admin/shipments/shipments';
import { AdminQrCodes } from './feature/admin/qr-codes/qr-codes';
import { AdminRegions } from './feature/admin/regions/regions';
import { AdminMessages } from './feature/admin/messages/messages';
import { AdminLogs } from './feature/admin/logs/logs';
import { AdminSettings } from './feature/admin/settings/settings';
import { AdminAccount } from './feature/admin/account/account';


export const routes: Routes = [
  { path: 'sign-up', component: SignUp },
  { path: 'sign-in', component: SignIn },
  { path: 'verify-email/:uuid', component: VerifyEmail },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password/:uuid', component: ResetPassword },
  { path: '', component: LandingPage },
  { path: 'home', component: Home },
  { path: 'profile-management', component: ProfileManagement },
  { path: 'account/details', component: ManageAccount },
  { path: 'account/agent', component: AgentDetails },
  { path: 'account/history', component: History },
  { path: 'account/shipping', component: Shipping },
  { path: 'account/help', component: HelpCenter },
  { path: 'agent/:id', component: AgentPage },
  { path: 'track-shipping/:id', component: TrackShipping },
  { path: 'messages', component: Messages },
  { path: 'search', component: Search },
  { path: 'qr-generator', component: QrGenerator },
  { path: 'qr/:uuid', component: QrView },
  { path: 'package-generator', component: PackageGenerator },
  { path: 'package/:uuid', component: PackageView },
  { path: 'account/my-products', component: MyProducts },

  // Admin Routes
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [AdminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboard },
      { path: 'users', component: AdminUsers },
      { path: 'agents', component: AdminAgents },
      { path: 'shipments', component: AdminShipments },
      { path: 'qr-codes', component: AdminQrCodes },
      { path: 'regions', component: AdminRegions },
      { path: 'settings', component: AdminSettings },
      { path: 'account', component: AdminAccount },
      { path: 'messages', component: AdminMessages },
      { path: 'logs', component: AdminLogs },
    ]
  },

];
