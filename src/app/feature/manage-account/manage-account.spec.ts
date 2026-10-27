import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { User } from '../../core/interfaces/auth.interface';
import { AddressService } from '../../core/services/address.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserService } from '../../core/services/user.service';
import { ProfileOnboardingWizard } from '../../shared/components/profile-onboarding-wizard/profile-onboarding-wizard';
import { ManageAccount } from './manage-account';

describe('Personal account profile', () => {
  it.each(['Buyer', 'Seller'])(
    'keeps warehouses out of the %s personal profile and guided setup',
    async (role) => {
      const user = {
        id: 4,
        uuid: 'user-uuid',
        role,
        username: 'example',
        firstname: 'Example',
        lastname: 'User',
        gender: 'Male',
        email: 'example@example.test',
        phone: '123456789',
        region: 'Arusha',
        district: 'Arusha',
        country: 'Tanzania',
        ward: '',
        address: '',
        profile_photo: null,
        is_profile_complete: true,
      } as User;
      const addressService = { getAddresses: vi.fn(), createAddress: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [ManageAccount],
        providers: [
          provideRouter([]),
          {
            provide: AuthService,
            useValue: {
              getUser: () => user,
              needsProfileCompletion: () => false,
              setProfileComplete: vi.fn(),
            },
          },
          {
            provide: UserService,
            useValue: { getProfile: () => of({ data: user, profile: { is_complete: true } }) },
          },
          { provide: AddressService, useValue: addressService },
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(ManageAccount);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Manage Account');
      expect(fixture.nativeElement.textContent).not.toContain('Physical Addresses');
      expect(fixture.nativeElement.querySelector('app-agent-addresses')).toBeNull();
      expect(addressService.getAddresses).not.toHaveBeenCalled();
      const wizard = fixture.debugElement.query(By.directive(ProfileOnboardingWizard))
        .componentInstance as ProfileOnboardingWizard;
      expect(wizard.steps.flatMap((step) => step.fields.map((field) => field.name))).not.toContain(
        'address_line',
      );
      expect(addressService.createAddress).not.toHaveBeenCalled();
    },
  );
});
