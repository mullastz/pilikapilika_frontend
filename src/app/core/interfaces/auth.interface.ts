// Simplified registration - only required fields
export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: 'Buyer' | 'Seller';
  // Optional fields that can be filled later (free text)
  firstname?: string;
  lastname?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone?: string;
  region?: string;
  district?: string;
  ward?: string;
  address?: string;
}

export interface SignupResponse {
  message: string;
  data: {
    user: User;
    uuid: string;
    email_verification_required: boolean;
  };
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
  profile: {
    is_complete: boolean;
    missing_fields: string[];
  };
}

// Email verification interfaces
export interface EmailVerificationRequest {
  email: string;
}

export interface EmailVerificationResponse {
  message: string;
  data?: {
    uuid: string;
    expires_at: string;
  };
}

export interface VerifyEmailParams {
  uuid: string;
  token: string;
}

export interface VerifyEmailResponse {
  message: string;
  data?: {
    user: User;
  };
}

export interface User {
  id: number;
  uuid: string;
  firstname: string;
  lastname: string;
  gender: string;
  username: string;
  email: string;
  phone: string | null;
  region: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  role: string;
  is_email_verified: boolean;
  is_agent_verified: boolean;
  is_admin: boolean;
  is_profile_complete: boolean;
  email_verified_at: string | null;
  agent_verified_at: string | null;
  agent_verification_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentProfile {
  id?: number;
  user_id?: number;
  availability_status: 'available' | 'busy' | 'offline';
  base_price: number | null;
  price_per_km: number | null;
  max_delivery_distance: number | null;
  avg_delivery_time: string | null;
  bio: string | null;
  id_number: string | null;
  is_verified: boolean;
  image: string | null;
  specializations: string[];
  transport_methods: string[];
  // Agent stats (read-only)
  total_deliveries: number;
  rating: number;
  total_reviews: number;
  success_rate: number;
  created_at?: string;
  updated_at?: string;
}

// Combined agent profile for display (merges User + AgentProfile)
export interface Agent extends User {
  availability_status: 'available' | 'busy' | 'offline';
  base_price: number | null;
  price_per_km: number | null;
  max_delivery_distance: number | null;
  avg_delivery_time: string | null;
  bio: string | null;
  id_number: string | null;
  is_verified: boolean; // Agent profile verified status
  image: string | null;
  specializations: string[];
  transport_methods: string[];
  total_deliveries: number;
  rating: number;
  total_reviews: number;
  success_rate: number;
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
  region?: string;
  district?: string;
  ward?: string;
  address?: string;
}

export interface UpdateProfileResponse {
  data: User;
  statusCode: number;
  message: string;
  profile?: {
    is_complete: boolean;
    missing_fields: string[];
  };
}

// Agent profile update request
export interface UpdateAgentProfileRequest {
  availability_status?: 'available' | 'busy' | 'offline';
  base_price?: number;
  price_per_km?: number | null;
  max_delivery_distance?: number | null;
  avg_delivery_time?: string | null;
  bio?: string | null;
  id_number?: string | null;
  specializations?: string[];
  transport_methods?: string[];
}

export interface AgentProfileResponse {
  data: Agent;
  statusCode: number;
  message: string;
}

// Agent verification interfaces
export interface AgentVerificationRequestResponse {
  message: string;
  data?: {
    requested_at: string;
    status: 'pending' | 'verified' | 'rejected';
  };
}

export interface AgentVerificationStatus {
  is_verified: boolean;
  verified_at?: string;
  verified_by?: string;
  requested_at?: string;
}

// Profile completion interface
export interface ProfileCompletionStatus {
  is_complete: boolean;
  missing_fields: string[];
}

export interface ProfileCompletionResponse {
  message: string;
  data: ProfileCompletionStatus;
}
