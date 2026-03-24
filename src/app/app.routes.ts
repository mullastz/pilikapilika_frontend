import { Routes } from '@angular/router';
import { SignUp } from './feature/auth/sign-up/sign-up';
import { SignIn } from './feature/auth/sign-in/sign-in';
import { LandingPage } from './feature/landing-page/landing-page';
import { ProfileManagement } from './feature/profile-management/profile-management';
import { ManageAccount } from './feature/manage-account/manage-account';
import { Shipping } from './feature/shipping/shipping';
import { History } from './feature/history/history';
import { HelpCenter } from './feature/help-center/help-center';
import { AgentPage } from './feature/agent-page/agent-page';
import { TrackShipping } from './feature/track-shipping/track-shipping';

import { Messages } from './feature/messages/messages';
import { Search } from './feature/search/search';
import { QrGenerator } from './feature/qr-generator/qr-generator';


export const routes: Routes = [
  { path: 'sign-up', component: SignUp },
  { path: 'sign-in', component: SignIn },
  { path: '', component: LandingPage },
  { path: 'profile-management', component: ProfileManagement },
  { path: 'account/manage', component: ManageAccount },
  { path: 'account/history', component: History },
  { path: 'account/shipping', component: Shipping },
  { path: 'account/help', component: HelpCenter },
  { path: 'agent/:id', component: AgentPage },
  { path: 'track-shipping/:id', component: TrackShipping },

  { path: 'messages', component: Messages },
  { path: 'search', component: Search },
  { path: 'qr-generator', component: QrGenerator },

];
