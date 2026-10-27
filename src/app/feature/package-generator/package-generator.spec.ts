import { NEVER } from 'rxjs';

import { PackageGenerator } from './package-generator';

import type { Location } from '@angular/common';
import type { ChangeDetectorRef } from '@angular/core';
import type { ActivatedRoute, Router } from '@angular/router';
import type { PackageService } from '../../core/services/package.service';
import type { QrCodeService } from '../../core/services/qr-code.service';

function createComponent(packageService: Partial<PackageService> = {}): PackageGenerator {
  return new PackageGenerator(
    null as unknown as Location,
    null as unknown as Router,
    packageService as PackageService,
    null as unknown as QrCodeService,
    null as unknown as ChangeDetectorRef,
    null as unknown as ActivatedRoute,
  );
}

describe('PackageGenerator photo removal', () => {
  it('tracks an existing photo removed individually without tracking new files', () => {
    const component = createComponent();
    const existingUrl = 'https://pub-example.r2.dev/packages/existing.jpg';
    component.packagePhotos = [
      { file: new File([], 'existing'), preview: existingUrl, isExisting: true },
      { file: new File(['new'], 'new'), preview: 'data:image/png;base64,new' },
    ];

    component.removePhoto(0);
    component.removePhoto(0);

    expect(component.packagePhotos).toEqual([]);
    expect(component.removedExistingPhotos).toEqual([existingUrl]);
  });

  it('queues existing photos once and ignores local previews when clearing all', () => {
    const component = createComponent();
    const existingUrl = 'https://pub-example.r2.dev/packages/existing.jpg';
    component.packagePhotos = [
      { file: new File([], 'existing'), preview: existingUrl, isExisting: true },
      { file: new File([], 'duplicate'), preview: existingUrl, isExisting: true },
      { file: new File(['new'], 'new'), preview: 'data:image/png;base64,new' },
      { file: new File(['local'], 'local'), preview: 'blob:http://localhost/photo' },
    ];

    component.clearAllPhotos();
    component.clearAllPhotos();

    expect(component.packagePhotos).toEqual([]);
    expect(component.removedExistingPhotos).toEqual([existingUrl]);
  });

  it('adds tracked URLs to the update payload', () => {
    let submittedFormData: FormData | undefined;
    const component = createComponent({
      update: (_uuid: string, formData: FormData) => {
        submittedFormData = formData;
        return NEVER;
      },
    });
    const existingUrl = 'https://pub-example.r2.dev/packages/existing.jpg';
    component.package.name = 'Parcel';
    component.selectedProducts = [
      { uuid: 'product-1', name: 'Product', cost: '', currency: '', quantity: 1, photos: [] },
    ];
    component.editUuid = 'package-1';
    component.removedExistingPhotos = [existingUrl];

    component.generatePackage();

    expect(submittedFormData?.getAll('removed_photos[]')).toEqual([existingUrl]);
  });

  it('clears removal tracking when the form resets', () => {
    const component = createComponent();
    component.removedExistingPhotos = ['https://pub-example.r2.dev/packages/existing.jpg'];

    component.resetForm();

    expect(component.removedExistingPhotos).toEqual([]);
  });
});
