import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface SiteContent {
  about_us_title?: string;
  about_us_subtitle?: string;
  about_us_body?: string;
  about_us_image?: string;
  about_us_mission_title?: string;
  about_us_mission_body?: string;
  about_us_vision_title?: string;
  about_us_vision_body?: string;
  hero_title?: string;
  hero_subtitle?: string;
  hero_image?: string;
  [key: string]: string | undefined;
}

@Injectable({
  providedIn: 'root',
})
export class ContentService {
  private cache: SiteContent | null = null;

  constructor(private api: ApiService) {}

  getContent(forceRefresh = false): Observable<SiteContent> {
    if (this.cache && !forceRefresh) {
      return of(this.cache);
    }
    return this.api.get<{ success: boolean; data: SiteContent }>('content').pipe(
      map((res) => res.data || {}),
      tap((data) => (this.cache = data)),
      catchError(() => of(this.cache ?? {}))
    );
  }

  clearCache(): void {
    this.cache = null;
  }
}
