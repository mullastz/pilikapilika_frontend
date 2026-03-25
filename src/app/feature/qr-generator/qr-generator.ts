import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface ProductDetails {
  description: string;
  category: string;
  packageType: string;
  quantity: number;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './qr-generator.html',
  styleUrl: './qr-generator.css',
})
export class QrGenerator {
  constructor(private location: Location, private router: Router) {}

  product: ProductDetails = {
    description: '',
    category: '',
    packageType: '',
    quantity: 1,
    totalWeight: '',
    totalVolume: '',
    productValue: '',
    productId: '',
  };

  supplier: SupplierInfo = {
    name: 'Shenzhen Tech Digital Co,Ltd',
    contactPerson: 'Li Wei',
    phone: '+86 138 0000 0000',
    pickupAddress: "Bao'an District Shenzhen, China",
  };

  productPhoto: string | null = null;
  generatedQR: string | null = null;
  showActions = false;

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
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.productPhoto = e.target?.result as string;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  generateQR() {
    if (!this.isFormValid()) return;

    const qrData = {
      product: this.product,
      supplier: this.supplier,
      photoIncluded: !!this.productPhoto,
      generatedAt: new Date().toISOString(),
    };

    // Create a data string for the QR code
    this.generatedQR = JSON.stringify(qrData, null, 2);
    this.showActions = true;
  }

  isFormValid(): boolean {
    return (
      this.product.description.trim() !== '' &&
      this.product.category !== '' &&
      this.product.packageType !== '' &&
      this.product.quantity > 0 &&
      this.product.totalWeight.trim() !== '' &&
      this.product.productValue.trim() !== ''
    );
  }

  downloadQR() {
    if (!this.generatedQR) return;

    // Create a canvas element to generate QR image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 500;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 500);

    // Draw placeholder QR pattern
    ctx.fillStyle = '#000000';
    const cellSize = 8;
    const qrSize = 240;
    const startX = 80;
    const startY = 40;

    // Draw position detection patterns (corners)
    this.drawPositionPattern(ctx, startX, startY, 28);
    this.drawPositionPattern(ctx, startX + qrSize - 28, startY, 28);
    this.drawPositionPattern(ctx, startX, startY + qrSize - 28, 28);

    // Draw random data pattern
    for (let i = 28; i < qrSize - 28; i += cellSize) {
      for (let j = 28; j < qrSize - 28; j += cellSize) {
        if (Math.random() > 0.5) {
          ctx.fillRect(startX + i, startY + j, cellSize - 1, cellSize - 1);
        }
      }
    }

    // Draw timing patterns
    ctx.fillStyle = '#000000';
    for (let i = 28; i < qrSize - 28; i += cellSize * 2) {
      ctx.fillRect(startX + i, startY + 14, cellSize - 1, 6);
      ctx.fillRect(startX + 14, startY + i, 6, cellSize - 1);
    }

    // Text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Scan for Product Details', 200, 320);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(this.product.productId || 'PID-XXXXX', 200, 345);

    ctx.font = '12px Arial';
    ctx.fillStyle = '#999999';
    ctx.fillText(`Qty: ${this.product.quantity} | ${this.product.category}`, 200, 370);

    // Download
    const link = document.createElement('a');
    link.download = `QR-${this.product.productId || 'product'}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }

  private drawPositionPattern(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 8, y + 8, size - 16, size - 16);
  }

  shareQR() {
    if (navigator.share && this.generatedQR) {
      navigator
        .share({
          title: 'Product QR Code',
          text: `Check product details: ${this.product.description}`,
        })
        .catch(() => {
          // Fallback - copy to clipboard
          this.copyToClipboard();
        });
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard() {
    navigator.clipboard.writeText(this.generatedQR || '').then(() => {
      alert('QR code data copied to clipboard!');
    });
  }

  sendToAgent() {
    // Navigate to messages component with product info
    this.router.navigate(['/messages'], {
      state: {
        productInfo: {
          product: this.product,
          supplier: this.supplier,
          qrData: this.generatedQR,
        },
      },
    });
  }

  goBack() {
    this.location.back();
  }

  clearPhoto() {
    this.productPhoto = null;
  }
}
