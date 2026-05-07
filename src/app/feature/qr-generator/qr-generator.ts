import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { QrCodeService, QrCodeResponse } from '../../core/services/qr-code.service';
import { environment } from '../../../environments/environment';

interface ProductDetails {
  name: string;
  cost: string;
  currency: string;
  description: string;
  category: string;
  packageType: string;
  quantity: number | null;
  totalWeight: string;
  totalVolume: string;
  productValue: string;
  productId: string;
}

interface SupplierInfo {
  name: string;
  contactPerson: string;
  phone: string;
  pickupAddress: string;
}

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, QRCodeComponent],
  templateUrl: './qr-generator.html',
  styleUrl: './qr-generator.css',
})
export class QrGenerator implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('qrCodeSection') qrCodeSection!: ElementRef<HTMLDivElement>;

  constructor(
    private location: Location,
    private router: Router,
    private qrCodeService: QrCodeService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.checkEditMode();
  }

  product: ProductDetails = {
    name: '',
    cost: '',
    currency: 'USD',
    description: '',
    category: '',
    packageType: '',
    quantity: null,
    totalWeight: '',
    totalVolume: '',
    productValue: '',
    productId: '',
  };

  supplier: SupplierInfo = {
    name: '',
    contactPerson: '',
    phone: '',
    pickupAddress: '',
  };

  productPhotos: { file: File; preview: string; isExisting?: boolean }[] = [];
  removedExistingPhotos: string[] = []; // Track URLs of removed existing photos
  generatedQR: string | null = null;
  showActions = false;
  isLoading = false;
  isDownloading = false;
  errorMessage: string | null = null;
  qrUuid: string | null = null;
  editUuid: string | null = null;
  isEditMode = false;

  currencies = ['USD', 'TSH', 'EUR', 'GBP'];

  categories = [
    'Electronics',
    'Fashion',
    'Home Appliances',
    'Toys',
    'Auto Parts',
    'Beauty & Health',
    'Sports',
    'Books',
    'Other',
  ];

  packageTypes = [
    'Box',
    'Carton',
    'Pallet',
    'Envelope',
    'Crate',
    'Bag',
    'Container',
  ];

  onPhotoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const remainingSlots = 12 - this.productPhotos.length;
      const filesToProcess = Math.min(input.files.length, remainingSlots);

      if (input.files.length > remainingSlots) {
        alert(`You can upload at most 12 images. Only the first ${filesToProcess} will be added.`);
      }

      for (let i = 0; i < filesToProcess; i++) {
        const file = input.files[i];
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = (e) => {
          this.productPhotos.push({
            file,
            preview: e.target?.result as string,
          });
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset input so the same file can be selected again
    input.value = '';
    // Also reset the ViewChild reference to ensure change detection
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  removePhoto(index: number) {
    const photo = this.productPhotos[index];
    if (photo.isExisting && photo.preview) {
      // Add to removed existing photos list
      this.removedExistingPhotos.push(photo.preview);
    }
    // Remove from display array
    this.productPhotos.splice(index, 1);
  }

  clearAllPhotos() {
    this.productPhotos = [];
  }

  generateQR() {
    if (!this.isFormValid()) return;
    this.isLoading = true;
    this.errorMessage = null;

    const formData = new FormData();
    formData.append('product_name', this.product.name.trim());
    formData.append('product_cost', this.product.cost.trim());
    formData.append('currency', this.product.currency);

    if (this.product.description.trim()) {
      formData.append('description', this.product.description.trim());
    }
    if (this.product.category) {
      formData.append('category', this.product.category);
    }
    if (this.product.packageType) {
      formData.append('package_type', this.product.packageType);
    }
    if (this.product.quantity !== null && this.product.quantity > 0) {
      formData.append('quantity', String(this.product.quantity));
    }
    if (this.product.totalWeight.trim()) {
      formData.append('total_weight', this.product.totalWeight.trim());
    }
    if (this.product.totalVolume.trim()) {
      formData.append('total_volume', this.product.totalVolume.trim());
    }
    if (this.product.productValue.trim()) {
      formData.append('product_value', this.product.productValue.trim());
    }
    if (this.product.productId.trim()) {
      formData.append('product_id', this.product.productId.trim());
    }

    formData.append('supplier_name', this.supplier.name.trim());
    formData.append('supplier_phone', this.supplier.phone.trim());

    if (this.supplier.contactPerson.trim()) {
      formData.append('supplier_contact_person', this.supplier.contactPerson.trim());
    }
    if (this.supplier.pickupAddress.trim()) {
      formData.append('supplier_pickup_address', this.supplier.pickupAddress.trim());
    }

    // Only append actual files, not placeholder files
    this.productPhotos.forEach((photo) => {
      if (photo.file.size > 0) { // Only append real files, not placeholders
        formData.append('photos[]', photo.file);
      }
    });

    // Add removed existing photos to inform backend to delete them
    if (this.removedExistingPhotos.length > 0) {
      this.removedExistingPhotos.forEach((photoUrl) => {
        formData.append('removed_photos[]', photoUrl);
      });
    }

    if (this.editUuid) {
      // Update existing QR code
      formData.append('_method', 'PUT');
      this.qrCodeService.update(this.editUuid, formData).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          // Handle both response structures (for update, data might be direct)
          const qrData = response.data?.qr_code || response.data;
          this.qrUuid = qrData.uuid;
          const origin = window.location.origin;
          const appUrl =
            /localhost|127\.0\.0\.1/.test(origin)
              ? environment.apiUrl.replace('/api/v1', '').replace(':8000', ':4200')
              : origin;
          this.generatedQR = `${appUrl}/qr/${qrData.uuid}`;
          this.showActions = true;
          this.cdr.detectChanges();
          
          // Auto-scroll to QR code section after update
          setTimeout(() => {
            this.scrollToQRCode();
          }, 300);
        },
        error: (err) => {
          this.isLoading = false;
          // Extract error message properly
          const errorMsg = err?.error?.message || 
                         err?.error?.errors?.photos?.[0] ||
                         err?.error?.errors?.[0] ||
                         'Failed to update QR code. Please try again.';
          
          // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
          setTimeout(() => {
            this.errorMessage = errorMsg;
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      // Create new QR code
      this.qrCodeService.store(formData).subscribe({
        next: (response: QrCodeResponse) => {
        this.isLoading = false;
        this.qrUuid = response.data.qr_code.uuid;
        this.cdr.detectChanges();
        const origin = window.location.origin;
        // If running on localhost/127.0.0.1, derive public URL from API server IP
        const appUrl =
          /localhost|127\.0\.0\.1/.test(origin)
            ? environment.apiUrl.replace('/api/v1', '').replace(':8000', ':4200')
            : origin;
        this.generatedQR = `${appUrl}/qr/${response.data.qr_code.uuid}`;
        this.showActions = true;
        this.cdr.detectChanges();
        
        // Auto-scroll to QR code section after generation
        setTimeout(() => {
          this.scrollToQRCode();
        }, 300);
      },
      error: (err) => {
        this.isLoading = false;
        // Extract error message properly
        const errorMsg = err?.error?.message || 
                       err?.error?.errors?.photos?.[0] ||
                       err?.error?.errors?.[0] ||
                       'Failed to generate QR code. Please try again.';
        
        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.errorMessage = errorMsg;
          this.cdr.detectChanges();
        });
      },
    });
    }
  }

  isFormValid(): boolean {
    return (
      this.product.name.trim() !== '' &&
      this.product.cost.trim() !== '' &&
      this.product.currency !== '' &&
      this.supplier.name.trim() !== '' &&
      this.supplier.phone.trim() !== ''
    );
  }

  downloadQR() {
    if (this.isDownloading) return;
    
    this.isDownloading = true;
    this.cdr.detectChanges();
    
    const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
    if (!canvas) {
      this.isDownloading = false;
      this.cdr.detectChanges();
      alert('QR code not ready for download.');
      return;
    }

    // Simulate download process with animation
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = `QR-${this.qrUuid || 'product'}.png`;
      link.href = canvas.toDataURL('image/png');
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
    const shareText = `Product: ${this.product.name}\nCost: ${this.product.currency} ${this.product.cost}\nSupplier: ${this.supplier.name}\nPhone: ${this.supplier.phone}\nView details: ${shareUrl}`;
    if (navigator.share) {
      navigator
        .share({
          title: 'Product QR Code',
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
      alert('QR code link copied to clipboard!');
    });
  }

goBack() {
  this.location.back();
}

sendToAgent() {
  this.router.navigate(['/messages'], {
    state: {
      productInfo: {
        product: this.product,
        supplier: this.supplier,
        qrData: this.generatedQR,
        qrUuid: this.qrUuid,
      },
    },
  });
}

checkEditMode() {
  const editUuid = this.route.snapshot.queryParamMap.get('edit');
  console.log('[QrGenerator] Edit mode check:', { editUuid });
  if (editUuid) {
    this.isEditMode = true;
    this.isLoading = true;
    this.editUuid = editUuid;
    this.loadQrCodeForEdit(editUuid);
  }
}

private loadQrCodeForEdit(uuid: string) {
  // Reset removed photos array when loading for edit
  this.removedExistingPhotos = [];
  
  this.qrCodeService.getByUuid(uuid).subscribe({
    next: (response: any) => {
      console.log('[QrGenerator] API response:', response);
      const data = response?.data;
      
      if (!data) {
        console.error('[QrGenerator] No QR code data found in response:', response);
        this.isLoading = false;
        this.isEditMode = false;
        return;
      }
      
      this.product = {
        name: data.product_name || '',
        cost: data.product_cost || '',
        currency: data.currency || 'USD',
        description: data.description || '',
        category: data.category || '',
        packageType: data.package_type || '',
        quantity: data.quantity,
        totalWeight: data.total_weight || '',
        totalVolume: data.total_volume || '',
        productValue: data.product_value || '',
        productId: data.product_id || '',
      };

      this.supplier = {
        name: data.supplier_name || '',
        contactPerson: data.supplier_contact_person || '',
        phone: data.supplier_phone || '',
        pickupAddress: data.supplier_pickup_address || '',
      };

      // Load photos if they exist
      if (data.photos && data.photos.length > 0) {
        this.productPhotos = data.photos.map((url: string) => ({
          file: new File([], 'placeholder'), // Placeholder for display
          preview: url,
          isExisting: true // Mark as existing photo
        }));
      }

      this.qrUuid = data.uuid;
      this.generatedQR = data.qr_data;
      this.isLoading = false;
      this.cdr.detectChanges();
    },
    error: (err: any) => {
      console.error('Failed to load QR code for edit:', err);
      this.isLoading = false;
      this.isEditMode = false;
    }
  });
}

  resetForm() {
    this.product = {
      name: '',
      cost: '',
      currency: 'USD',
      description: '',
      category: '',
      packageType: '',
      quantity: null,
      totalWeight: '',
      totalVolume: '',
      productValue: '',
      productId: '',
    };
    this.supplier = {
      name: '',
      contactPerson: '',
      phone: '',
      pickupAddress: '',
    };
    this.productPhotos = [];
    this.generatedQR = null;
    this.showActions = false;
    this.errorMessage = null;
    this.qrUuid = null;
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
