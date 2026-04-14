export interface SignupRequest {
  firstname: string;
  lastname: string;
  gender: 'Male' | 'Female' | 'Other';
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  region_id?: number | null;
  district_id?: number | null;
  ward?: string;
  address?: string;
  role: 'Buyer' | 'Seller';
}

export interface SignupResponse {
  message: string;
  data: User;
  statusCode: number;
}

export interface LoginRequest {
  login: string; // email or username
  password: string;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  data: User;
}

export interface User {
  id: number;
  firstname: string;
  lastname: string;
  gender: string;
  username: string;
  email: string;
  phone: string | null;
  region_id: number | null;
  district_id: number | null;
  ward: string | null;
  address: string | null;
  role: string;
  isApproved: number;
  created_at: string;
  updated_at: string;
  region?: Region;
  district?: District;
}

export interface Region {
  id: number;
  name: string;
  districts_count?: number;
  districts?: District[];
}

export interface District {
  id: number;
  name: string;
  region_id: number;
  region?: Region;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface UpdateProfileRequest {
  firstname?: string;
  lastname?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone?: string;
  region_id?: number | null;
  district_id?: number | null;
  ward?: string;
  address?: string;
}

export interface UpdateProfileResponse {
  data: User;
  statusCode: number;
  message: string;
}
