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

  it('requires a valid received quantity before a manual warehouse update', () => {
    const receive = vi.fn().mockReturnValue(of({ success: true, message: 'Received' }));
    TestBed.inject(ShipmentService).markAsAtWarehouse = receive;
    component.markAsAtWarehouseAction({ ...shipment, status: 'confirmed', products: [{ quantity: 10 }] });
    component.executeConfirmedAction();
    expect(receive).not.toHaveBeenCalled();
    expect(component.confirmModalOpen()).toBe(true);
    expect(component.warehouseQuantityError()).toContain('1 and 10');
    component.warehouseQuantity.set(11);
    component.executeConfirmedAction();
    expect(receive).not.toHaveBeenCalled();
    component.warehouseQuantity.set(10);
    component.executeConfirmedAction();
    expect(receive).toHaveBeenCalledWith(shipment.id, 10);
  });

  it('confirms partial receipt before submitting and allows cancelling without a mutation', () => {
    const receive = vi.fn().mockReturnValue(of({ success: true, message: 'Partial receipt' }));
    TestBed.inject(ShipmentService).markAsAtWarehouse = receive;
    component.markAsAtWarehouseAction({ ...shipment, status: 'confirmed', products: [{ quantity: 10 }] });
    component.warehouseQuantity.set(4);
    component.executeConfirmedAction();
    expect(receive).not.toHaveBeenCalled();
    expect(component.warehousePartialConfirm()).toBe(true);
    component.executeConfirmedAction();
    expect(receive).toHaveBeenCalledWith(shipment.id, 4);
  });

  it('filters My Shipping by sea or air using the same selector as agents', () => {
    vi.spyOn(component, 'isAgent').mockReturnValue(false);
    const getShipments = vi.fn().mockReturnValue(of({ success: true, data: { shipments: [], pagination: { has_more: false } } }));
    TestBed.inject(ShipmentService).getUserShipments = getShipments;
    component.page.set(3);
    expect(component.transportMode()).toBe('sea');
    component.setTransportMode('air');
    expect(getShipments).toHaveBeenCalledWith(1, 10, 'air');
    expect(component.page()).toBe(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('All Transport');
    expect(fixture.nativeElement.textContent).not.toContain('Parcel transport');
  });

  it('shows clients their own active sea and air parcels without requesting or displaying containers', () => {
    vi.spyOn(component, 'isAgent').mockReturnValue(false);
    const getShipments = vi.fn((_page = 1, _size = 10, mode?: 'sea' | 'air') => of({ success: true, data: {
      shipments: [{ ...shipment, id: mode ?? 'sea', title: `My ${mode} parcel`, transport_method: mode }], pagination: { current_page: 1, last_page: 1, per_page: 10, total: 1, has_more: false },
    } }));
    const getContainers = vi.fn();
    TestBed.inject(ShipmentService).getUserShipments = getShipments;
    TestBed.inject(ContainerService).getContainers = getContainers;
    component.dashboardOnly = true;
    component.loadDashboardContainers();
    component.loadDashboardParcels();
    fixture.detectChanges();
    expect(getContainers).not.toHaveBeenCalled();
    expect(getShipments).toHaveBeenCalledWith(1, 10, 'sea', true);
    expect(getShipments).toHaveBeenCalledWith(1, 10, 'air', true);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Active Sea Freight Parcels');
    expect(page.textContent).toContain('Active Air Freight Parcels');
    expect(page.textContent).toContain('My sea parcel');
    expect(page.textContent).toContain('My air parcel');
    expect(page.querySelector('[aria-label="Filter parcels by transport"]')).toBeNull();
    expect(page.textContent).not.toContain('Active Containers');
    expect(page.textContent).not.toContain('View Batch');
  });

  it('colors only the card status above progress and keeps status tabs wide enough to scroll', () => {
    component.viewModalOpen.set(false);
    const getShipments = vi.fn().mockReturnValue(of({ success: true, data: { shipments: [shipment] } }));
    TestBed.inject(ShipmentService).getAgentShipments = getShipments;
    component.refreshShipments();
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const progressStatus = page.querySelector('.shipment-card .uppercase') as HTMLElement;
    expect(progressStatus.classList.contains('text-yellow-700')).toBe(true);
    const tabs = [...page.querySelectorAll('.status-tabs > button')];
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.every(tab => tab.classList.contains('flex-none') && tab.classList.contains('min-w-max'))).toBe(true);
    expect(page.querySelector('.status-tabs .text-yellow-700')).toBeNull();
    const stageLabels = [...page.querySelectorAll('.shipment-card .text-gray-400')];
    expect(stageLabels.some(label => label.textContent?.includes('Half Loaded'))).toBe(true);
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
