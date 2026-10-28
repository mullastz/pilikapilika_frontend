import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Shipping } from './shipping';
import { ShipmentService, type Shipment } from '../../core/services/shipment.service';
import { ContainerService } from '../../core/services/container.service';
import { AuthService } from '../../core/services/auth.service';
import { AgentService } from '../../core/services/agent.service';
import { QrCodeService } from '../../core/services/qr-code.service';
import { environment } from '../../../environments/environment';

describe('Shipping', () => {
  let component: Shipping;
  let fixture: ComponentFixture<Shipping>;
  const getProduct = vi.fn();
  const photoUrl = 'https://pub-example.r2.dev/qr-code-photos/shoes.jpg';
  const apiOrigin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
  const shipment: Shipment = {
    id: 'shipment-id', user_id: 'customer-id', agent_id: 'agent-id',
    tracking_number: 'PKG123', title: 'Shoes shipment', pickup_address: 'Arusha',
    destination_address: 'Dar es Salaam', estimated_price: 1000,
    status: 'pending_confirmation', created_at: '2026-10-28T10:00:00Z',
    updated_at: '2026-10-28T10:00:00Z',
    products: [{ qr_code_uuid: 'product-uuid', product_name: 'Shoes', quantity: 1 }],
  };

  beforeEach(async () => {
    getProduct.mockReset().mockReturnValue(of({ data: {
      uuid: 'product-uuid', product_name: 'Shoes', photos: [photoUrl, '/storage/qr-code-photos/second.jpg'],
    } }));
    await TestBed.configureTestingModule({
      imports: [Shipping],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getUser: () => ({ uuid: 'agent-id', role: 'Seller' }) } },
        { provide: ShipmentService, useValue: {
          getAgentShipments: () => of({ success: true, data: { shipments: [] } }),
        } },
        { provide: ContainerService, useValue: {} },
        { provide: AgentService, useValue: {} },
        { provide: QrCodeService, useValue: { getByUuid: getProduct } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
            queryParams: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Shipping);
    component = fixture.componentInstance;
    await fixture.whenStable();
    component.selectedShipmentDetail.set(shipment);
    component.viewModalOpen.set(true);
    fixture.detectChanges();
  });

  it('loads QR-linked products and renders all uploaded photos with full-size links', () => {
    const product = shipment.products![0];
    component.selectProduct(component.getProductUuid(product));
    fixture.detectChanges();

    expect(getProduct).toHaveBeenCalledWith('product-uuid');
    const gallery = fixture.nativeElement.querySelector('.product-photo-gallery') as HTMLElement;
    const images = [...gallery.querySelectorAll('img')];
    expect(images.map(image => image.getAttribute('src'))).toEqual([
      photoUrl, `${apiOrigin}/storage/qr-code-photos/second.jpg`,
    ]);
    expect(gallery.querySelector('a')?.getAttribute('href')).toBe(photoUrl);
    expect(gallery.querySelector('a')?.getAttribute('target')).toBe('_blank');
    expect(gallery.querySelector('a')?.getAttribute('rel')).toContain('noopener');
    expect(component.productDetailsLoading().size).toBe(0);
  });

  it.each([
    { qr_code_uuid: 'product-uuid', id: 123 },
    { uuid: 'product-uuid', id: 123 },
    { id: 'product-uuid' },
  ])('uses the public product UUID for the supported shipment formats: %j', product => {
    expect(component.getProductUuid(product)).toBe('product-uuid');
  });

  it('does not render an empty gallery when no photos were uploaded', () => {
    getProduct.mockReturnValue(of({ data: { uuid: 'product-uuid', photos: [] } }));
    component.selectProduct('product-uuid');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.product-photo-gallery')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Product Information');
  });

  it('keeps saved shipment photos usable when refreshing product details fails', () => {
    const product = {
      qr_code_uuid: 'product-uuid', product_name: 'Shoes',
      photos: ['http://localhost:8000/storage/qr-code-photos/saved.jpg'],
    };
    component.selectedShipmentDetail.set({ ...shipment, products: [product] });
    getProduct.mockReturnValue(throwError(() => new Error('API unavailable')));
    component.selectProduct('product-uuid');
    fixture.detectChanges();

    expect(component.getProductPhotos(product)).toEqual([`${apiOrigin}/storage/qr-code-photos/saved.jpg`]);
    expect(fixture.nativeElement.querySelector('.product-photo-gallery img')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Could not load product details');
    expect(component.productDetailsLoading().size).toBe(0);
  });

  it('retains both products when photo requests finish out of order', () => {
    const first = new Subject<{ data: { photos: string[] } }>();
    const second = new Subject<{ data: { photos: string[] } }>();
    getProduct.mockReturnValueOnce(first).mockReturnValueOnce(second);
    component.selectProduct('first-uuid');
    component.selectProduct('second-uuid');
    second.next({ data: { photos: ['https://pub-example.r2.dev/second.jpg'] } });
    second.complete();
    first.next({ data: { photos: [photoUrl] } });
    first.complete();

    expect(component.productDetailsMap().size).toBe(2);
    expect(component.getProductPhotos({ qr_code_uuid: 'first-uuid' })).toEqual([photoUrl]);
    component.selectProduct('first-uuid');
    expect(getProduct).toHaveBeenCalledTimes(2);
  });

  it('ignores a photo response belonging to a shipment that is no longer open', () => {
    const request = new Subject<{ data: { photos: string[] } }>();
    getProduct.mockReturnValue(request);
    component.selectProduct('product-uuid');
    component.selectedShipmentDetail.set(null);
    request.next({ data: { photos: [photoUrl] } });
    request.complete();
    expect(component.productDetailsMap().size).toBe(0);
  });
});
