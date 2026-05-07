import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { PackageService, PackageRequest, Package } from '../../core/services/package.service';
import { QrCodeService } from '../../core/services/qr-code.service';
import { environment } from '../../../environments/environment';

interface QrCodeItem {
  uuid: string;
  product_name: string;
  product_cost: string;
  currency: string;
  description: string | null;
  category: string | null;
  package_type: string | null;
  quantity: number | null;
  total_weight: string | null;
  total_volume: string | null;
  product_value: string | null;
  product_id: string | null;
  supplier_name: string;
  supplier_phone: string;
  supplier_contact_person: string | null;
  supplier_pickup_address: string | null;
  photos: string[] | null;
  created_at: string;
  updated_at: string;
}

interface PackageDetails {
  name: string;
  description: string;
  pickupAddress: string;
  destinationAddress: string;
  trackingNumber: string;
}

interface SelectedProduct {
  uuid: string;
  name: string;
  cost: string;
  currency: string;
  quantity: number;
  photos: string[];
}

@Component({
  selector: 'app-package-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, QRCodeComponent],
  templateUrl: './package-generator.html',
  styleUrl: './package-generator.css',
})
export class PackageGenerator implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('qrCodeSection') qrCodeSection!: ElementRef<HTMLDivElement>;

  package: PackageDetails = {
    name: '',
    description: '',
    pickupAddress: '',
    destinationAddress: '',
    trackingNumber: '',
  };

  availableProducts: QrCodeItem[] = [];
  selectedProducts: SelectedProduct[] = [];
  packagePhotos: { file: File; preview: string }[] = [];
  generatedQR: string | null = null;
  showActions = false;
  isLoading = false;
  isDownloading = false;
  errorMessage: string | null = null;
  packageUuid: string | null = null;
  editUuid: string | null = null;
  isEditMode = false;

  currencies = ['USD', 'TSH', 'EUR', 'GBP'];

  packageTypes = [
    'Box',
    'Carton',
    'Pallet',
    'Envelope',
    'Crate',
    'Bag',
    'Container',
  ];

  constructor(
    private location: Location,
    private router: Router,
    private packageService: PackageService,
    private qrCodeService: QrCodeService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.checkEditMode();
    this.loadAvailableProducts();
  }

  checkEditMode() {
    const editUuid = this.route.snapshot.queryParamMap.get('edit');
    console.log('[PackageGenerator] Edit mode check:', { editUuid });
    if (editUuid) {
      this.isEditMode = true;
      this.isLoading = true;
      this.editUuid = editUuid;
      this.loadPackageForEdit(editUuid);
    }
  }

  loadPackageForEdit(uuid: string) {
    this.packageService.getByUuid(uuid).subscribe({
      next: (res: any) => {
        const data = res?.data?.package;
        if (data) {
          this.editUuid = uuid;
          this.packageUuid = uuid;
          
          // Populate form with existing data
          this.package = {
            name: data.name || '',
            description: data.description || '',
            pickupAddress: data.pickup_address || '',
            destinationAddress: data.destination_address || '',
            trackingNumber: data.tracking_number || '',
          };

          // Load selected products
          if (data.products && data.products.length > 0) {
            this.selectedProducts = data.products.map((prod: any) => ({
              uuid: prod.uuid,
              name: '', // Will be filled from available products
              cost: '',
              currency: '',
              quantity: prod.quantity,
              photos: []
            }));
          }

          // Load photos if they exist
          if (data.photos && data.photos.length > 0) {
            this.packagePhotos = data.photos.map((url: string) => ({
              file: new File([], 'placeholder'),
              preview: url
            }));
          }

          this.generatedQR = data.qr_data;
          this.showActions = true;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Failed to load package for edit:', err);
        this.isLoading = false;
        this.isEditMode = false;
      }
    });
  }

  loadAvailableProducts() {
    this.qrCodeService.getAll().subscribe({
      next: (res: any) => {
        this.availableProducts = res?.data ?? [];
        // Fill selected product names if in edit mode
        if (this.selectedProducts.length > 0) {
          this.selectedProducts = this.selectedProducts.map(selected => {
            const product = this.availableProducts.find(p => p.uuid === selected.uuid);
            return {
              ...selected,
              name: product?.product_name || '',
              cost: product?.product_cost || '',
              currency: product?.currency || '',
              photos: product?.photos || []
            };
          });
        }
      },
      error: (err) => {
        console.error('Failed to load available products:', err);
      }
    });
  }

  onPhotoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const remainingSlots = 12 - this.packagePhotos.length;
      const filesToProcess = Math.min(input.files.length, remainingSlots);

      for (let i = 0; i < filesToProcess; i++) {
        const file = input.files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
          this.packagePhotos.push({
            file: file,
            preview: e.target?.result as string
          });
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset file input
    input.value = '';
  }

  removePhoto(index: number) {
    this.packagePhotos.splice(index, 1);
  }

  clearAllPhotos() {
    this.packagePhotos = [];
  }

  addProduct(product: QrCodeItem) {
    const existing = this.selectedProducts.find(p => p.uuid === product.uuid);
    if (!existing) {
      this.selectedProducts.push({
        uuid: product.uuid,
        name: product.product_name,
        cost: product.product_cost,
        currency: product.currency,
        quantity: 1,
        photos: product.photos || []
      });
    }
  }

  removeProduct(uuid: string) {
    this.selectedProducts = this.selectedProducts.filter(p => p.uuid !== uuid);
  }

  updateProductQuantity(uuid: string, quantity: number) {
    const product = this.selectedProducts.find(p => p.uuid === uuid);
    if (product && quantity > 0) {
      product.quantity = quantity;
    }
  }

  isFormValid(): boolean {
    return (
      this.package.name.trim() !== '' &&
      this.selectedProducts.length > 0
    );
  }

  generatePackage() {
    if (!this.isFormValid()) return;
    
    this.isLoading = true;
    this.errorMessage = null;

    // Log package data before sending
    console.log('Package Data:', this.package);
    console.log('Selected Products:', this.selectedProducts);
    console.log('Package Photos:', this.packagePhotos);

    const formData = new FormData();
    formData.append('name', this.package.name.trim());
    
    // Always include optional fields, even if empty
    formData.append('description', this.package.description?.trim() || '');
    formData.append('pickup_address', this.package.pickupAddress?.trim() || '');
    formData.append('destination_address', this.package.destinationAddress?.trim() || '');
    formData.append('tracking_number', this.package.trackingNumber?.trim() || '');

    // Add selected products
    this.selectedProducts.forEach((product, index) => {
      formData.append(`products[${index}][uuid]`, product.uuid);
    });

    // Add photos
    this.packagePhotos.forEach((photo) => {
      if (photo.file.size > 0) {
        formData.append('photos[]', photo.file);
      }
    });

    // Log FormData contents for debugging
    console.log('FormData contents:');
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    if (this.editUuid) {
      // Update existing package
      this.packageService.update(this.editUuid, formData).subscribe({
        next: (response: any) => {
          console.log('Package update successful:', response);
          this.isLoading = false;
          const qrData = response.data?.qr_code || response.data;
          this.packageUuid = qrData.uuid;
          const origin = window.location.origin;
          const appUrl =
            /localhost|127\.0\.0\.1/.test(origin)
              ? environment.apiUrl.replace('/api/v1', '').replace(':8000', ':4200')
              : origin;
          this.generatedQR = `${appUrl}/package/${qrData.uuid}`;
          this.showActions = true;
          this.cdr.detectChanges();
          
          // Auto-scroll to QR code section after update
          setTimeout(() => {
            this.scrollToQRCode();
          }, 300);
        },
        error: (error) => {
          console.error('Package update error:', error);
          console.error('Error status:', error.status);
          console.error('Error response:', error.error);
          this.isLoading = false;
          const errorMsg = error.error?.message || 
                         error.error?.errors?.photos?.[0] ||
                         error.error?.errors?.[0] ||
                         'Failed to update package. Please try again.';
          setTimeout(() => {
            this.errorMessage = errorMsg;
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      // Create new package
      this.packageService.store(formData).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.packageUuid = response.data.qr_code.uuid;
          const origin = window.location.origin;
          const appUrl =
            /localhost|127\.0\.0\.1/.test(origin)
              ? environment.apiUrl.replace('/api/v1', '').replace(':8000', ':4200')
              : origin;
          this.generatedQR = `${appUrl}/package/${response.data.qr_code.uuid}`;
          this.showActions = true;
          this.cdr.detectChanges();
          
          // Auto-scroll to QR code section after generation
          setTimeout(() => {
            this.scrollToQRCode();
          }, 300);
        },
        error: (err) => {
          this.isLoading = false;
          const errorMsg = err?.error?.message || 
                         err?.error?.errors?.photos?.[0] ||
                         err?.error?.errors?.[0] ||
                         'Failed to generate package. Please try again.';
          setTimeout(() => {
            this.errorMessage = errorMsg;
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  downloadQR() {
    if (!this.generatedQR || this.isDownloading) return;
    
    this.isDownloading = true;
    this.cdr.detectChanges();
    
    const qrElement = document.querySelector('qrcode canvas') as HTMLCanvasElement;
    if (!qrElement) {
      this.isDownloading = false;
      this.cdr.detectChanges();
      return;
    }

    // Simulate download process with animation
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = `Package-${this.packageUuid || 'package'}.png`;
      link.href = qrElement.toDataURL('image/png');
      link.click();
      
      // Reset download state after a short delay
      setTimeout(() => {
        this.isDownloading = false;
        this.cdr.detectChanges();
      }, 1000);
    }, 500);
  }

  shareQR() {
    const shareUrl = this.generatedQR || '';
    const shareText = `Package: ${this.package.name}\nProducts: ${this.selectedProducts.length}\nView details: ${shareUrl}`;
    if (navigator.share) {
      navigator
        .share({
          title: 'Package QR Code',
          text: shareText,
          url: shareUrl,
        })
        .catch(() => {
          this.copyToClipboard();
        });
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard() {
    const text = this.generatedQR || '';
    navigator.clipboard.writeText(text).then(() => {
      alert('Package QR code link copied to clipboard!');
    });
  }

  sendToAgent() {
    this.router.navigate(['/messages'], {
      state: {
        packageInfo: {
          package: this.package,
          products: this.selectedProducts,
          qrData: this.generatedQR,
          packageUuid: this.packageUuid,
        },
      },
    });
  }

  goBack() {
    this.location.back();
  }

  resetForm() {
    this.package = {
      name: '',
      description: '',
      pickupAddress: '',
      destinationAddress: '',
      trackingNumber: '',
    };
    this.selectedProducts = [];
    this.packagePhotos = [];
    this.generatedQR = null;
    this.showActions = false;
    this.errorMessage = null;
    this.packageUuid = null;
    this.editUuid = null;
    this.isEditMode = false;
  }

  scrollToQRCode() {
    // Try multiple methods to ensure scrolling works
    setTimeout(() => {
      // Method 1: Try ViewChild reference first
      if (this.qrCodeSection && this.qrCodeSection.nativeElement) {
        this.qrCodeSection.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        return;
      }
      
      // Method 2: Fallback to getElementById
      const qrElement = document.getElementById('qrCodeSection');
      if (qrElement) {
        qrElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        return;
      }
      
      // Method 3: Look for any QR code section
      const qrSection = document.querySelector('div[class*="bg-white"][class*="dark:bg-[#1a1a1a]"][class*="rounded-2xl"]:has(qrcode)');
      if (qrSection) {
        qrSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        return;
      }
      
      // Method 4: Last resort - scroll to bottom of page
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }
}
