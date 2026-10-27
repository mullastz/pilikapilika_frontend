import { QrGenerator } from './qr-generator';

import type { Location } from '@angular/common';
import type { ChangeDetectorRef } from '@angular/core';
import type { ActivatedRoute, Router } from '@angular/router';
import type { AddressService } from '../../core/services/address.service';
import type { AgentService } from '../../core/services/agent.service';
import type { AuthService } from '../../core/services/auth.service';
import type { QrCodeService } from '../../core/services/qr-code.service';
import type { UserService } from '../../core/services/user.service';

function createComponent(): QrGenerator {
  return new QrGenerator(
    null as unknown as Location,
    null as unknown as Router,
    null as unknown as QrCodeService,
    null as unknown as AgentService,
    null as unknown as AuthService,
    null as unknown as UserService,
    null as unknown as AddressService,
    null as unknown as ChangeDetectorRef,
    null as unknown as ActivatedRoute,
  );
}

describe('QrGenerator photo removal', () => {
  it('clears pending removals when starting a new product', () => {
    const component = createComponent();
    component.removedExistingPhotos = ['https://pub-example.r2.dev/qr-code-photos/old.jpg'];
    component.resetForm();
    expect(component.removedExistingPhotos).toEqual([]);
  });

  it('queues existing photos once and ignores local previews when clearing all', () => {
    const component = createComponent();
    const existingUrl = 'https://pub-example.r2.dev/products/existing.jpg';
    component.productPhotos = [
      { file: new File([], 'existing'), preview: existingUrl, isExisting: true },
      { file: new File([], 'duplicate'), preview: existingUrl, isExisting: true },
      { file: new File(['new'], 'new'), preview: 'data:image/png;base64,new' },
      { file: new File(['local'], 'local'), preview: 'blob:http://localhost/photo' },
    ];

    component.clearAllPhotos();
    component.clearAllPhotos();

    expect(component.productPhotos).toEqual([]);
    expect(component.removedExistingPhotos).toEqual([existingUrl]);
  });
});
