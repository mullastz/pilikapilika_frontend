import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProfileCompletionService, ProfileAnalysis, MissingFieldInfo } from '../../../core/services/profile-completion.service';

/**
 * ProfileCompletionPopup - Smart profile completion modal
 *
 * This component displays a beautiful, informative popup that:
 * - Detects the user's role (customer vs agent)
 * - Shows exactly which fields are missing
 * - Explains WHY each field matters (not just WHAT is missing)
 * - Prioritizes fields by importance (critical > high > medium)
 * - Provides a clear call-to-action to complete the profile
 */
@Component({
  selector: 'app-profile-completion-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-completion-popup.html',
  styleUrl: './profile-completion-popup.css'
})
export class ProfileCompletionPopup {
  @Input() analysis: ProfileAnalysis | null = null;
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() completeProfile = new EventEmitter<void>();

  private router = inject(Router);
  private profileService = inject(ProfileCompletionService);

  get isVisible(): boolean {
    return this.show && !!this.analysis && !this.analysis.isComplete;
  }

  get missingFields(): MissingFieldInfo[] {
    if (!this.analysis) return [];
    // Sort by importance: critical first, then high, then medium
    return [...this.analysis.missingFields].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return order[a.importance] - order[b.importance];
    });
  }

  get criticalFields(): MissingFieldInfo[] {
    return this.missingFields.filter(f => f.importance === 'critical');
  }

  get highFields(): MissingFieldInfo[] {
    return this.missingFields.filter(f => f.importance === 'high');
  }

  get mediumFields(): MissingFieldInfo[] {
    return this.missingFields.filter(f => f.importance === 'medium');
  }

  get hasCriticalFields(): boolean {
    return this.criticalFields.length > 0;
  }

  get hasHighFields(): boolean {
    return this.highFields.length > 0;
  }

  get hasMediumFields(): boolean {
    return this.mediumFields.length > 0;
  }

  get completionPercentage(): number {
    return this.analysis?.completionPercentage ?? 0;
  }

  get role(): 'customer' | 'agent' {
    return this.analysis?.role ?? 'customer';
  }

  get urgentMessage(): string {
    if (!this.analysis) return '';
    return this.profileService.getUrgentMessage(this.role, this.analysis.missingFields.length);
  }

  get completionMessage(): string {
    return this.profileService.getCompletionMessage(this.role);
  }

  getImportanceLabel(importance: 'critical' | 'high' | 'medium'): string {
    return this.profileService.getImportanceLabel(importance);
  }

  getImportanceColorClass(importance: 'critical' | 'high' | 'medium'): string {
    return this.profileService.getImportanceColor(importance);
  }

  getImportanceIcon(importance: 'critical' | 'high' | 'medium'): string {
    switch (importance) {
      case 'critical':
        return 'fa-solid fa-circle-exclamation';
      case 'high':
        return 'fa-solid fa-triangle-exclamation';
      case 'medium':
        return 'fa-solid fa-circle-info';
      default:
        return 'fa-solid fa-circle-info';
    }
  }

  getProgressBarColor(): string {
    if (this.completionPercentage < 30) return 'bg-red-500';
    if (this.completionPercentage < 70) return 'bg-orange-500';
    return 'bg-green-500';
  }

  onClose(): void {
    this.close.emit();
  }

  onCompleteProfile(): void {
    const route = this.profileService.getProfileCompletionRoute(this.role);
    this.completeProfile.emit();
    this.router.navigate([route]);
  }

  onBackdropClick(event: MouseEvent): void {
    // Only close if clicking the backdrop itself, not the modal content
    if (event.target === event.currentTarget) {
      // Don't close on backdrop click for critical incomplete profiles
      // Users must explicitly click "Complete Profile" or the close button
      if (!this.hasCriticalFields) {
        this.onClose();
      }
    }
  }

  /**
   * Get a friendly description of what the field is used for
   */
  getFieldUsageDescription(field: MissingFieldInfo): string {
    return field.whyItMatters;
  }
}
