import { Injectable } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  User,
  Region,
  District,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ProfileCompletionResponse,
  ProfileCompletionStatus
} from '../interfaces/auth.interface';

/**
 * UserService - Handles user profile operations
 * (Profile management, Regions/Districts, Profile completion)
 */
@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private api: ApiService) {}

  // ========== User Profile APIs ==========

  getProfile(): Observable<{ data: User; profile?: { is_complete: boolean; missing_fields: string[] } }> {
    return this.api.get<{ data: User; profile?: { is_complete: boolean; missing_fields: string[] } }>('me');
  }

  updateProfile(data: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    return this.api.put<UpdateProfileResponse>('me', data);
  }

  updateUserById(id: number, data: UpdateProfileRequest): Observable<UpdateProfileResponse> {
    return this.api.put<UpdateProfileResponse>(`users/${id}`, data);
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`users/${id}`);
  }

  // ========== Profile Completion APIs ==========

  getProfileCompletionStatus(): Observable<ProfileCompletionStatus> {
    return this.api.get<ProfileCompletionResponse>('me/profile-completion').pipe(
      map(response => response.data)
    );
  }

  // ========== Region & District APIs ==========

  getRegions(): Observable<Region[]> {
    return this.api.get<{ data: Region[] }>('regions').pipe(
      map(response => response.data)
    );
  }

  getDistrictsByRegion(regionId: number): Observable<District[]> {
    return this.api.get<{ data: { region: string; districts: District[] } }>(`regions/${regionId}/districts`).pipe(
      map(response => response.data.districts)
    );
  }

  getAllDistricts(): Observable<District[]> {
    return this.api.get<{ data: District[] }>('districts').pipe(
      map(response => response.data)
    );
  }

  // ========== Password Management ==========

  changePassword(data: { current_password: string; new_password: string; new_password_confirmation: string }): Observable<{ message: string; data: User }> {
    return this.api.post<{ message: string; data: User }>('change-password', data);
  }

  forgotPassword(email: string): Observable<{ message: string; data: User }> {
    return this.api.post<{ message: string; data: User }>('forgot-password', { email });
  }
}
