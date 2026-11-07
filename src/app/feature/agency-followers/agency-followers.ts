import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AgencyFollower, AgencyFollowersData, AgentFollowService } from '../../core/services/agent-follow.service';
import { resolveImageUrl } from '../../core/utils/image-url.util';

@Component({
  selector: 'app-agency-followers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './agency-followers.html',
})
export class AgencyFollowers implements OnInit {
  private readonly api = inject(AgentFollowService);
  private readonly destroyRef = inject(DestroyRef);
  readonly appliedSearch = signal('');
  readonly data = signal<AgencyFollowersData | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly fallbackPhoto = 'assets/landingpage_images/defaultprofile.jfif';
  search = '';

  ngOnInit(): void { this.load(); }

  load(page = 1, query = this.appliedSearch()): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.appliedSearch.set(query);
    this.api.followers(page, query).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: response => this.data.set(response.data),
      error: error => {
        this.data.set(null);
        this.error.set(error.error?.message || 'Unable to load your followers. Please try again.');
      },
    });
  }

  searchFollowers(): void { this.load(1, this.search.trim()); }
  photo(follower: AgencyFollower): string { return resolveImageUrl(follower.profile_photo, this.fallbackPhoto); }
  name(follower: AgencyFollower): string { return [follower.firstname, follower.lastname].filter(Boolean).join(' ') || 'Customer'; }
  location(follower: AgencyFollower): string { return [follower.district, follower.region].filter(Boolean).join(', '); }
  onPhotoError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    if (!image.src.endsWith(this.fallbackPhoto)) image.src = this.fallbackPhoto;
  }
}
