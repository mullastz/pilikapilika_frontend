import { Injectable } from '@angular/core';
import { User, AgentProfile } from '../interfaces/auth.interface';

/**
 * Field requirement definition for profile completion
 */
export interface FieldRequirement {
  field: string;
  label: string;
  description: string;
  importance: 'critical' | 'high' | 'medium';
  whyItMatters: string;
  applicableTo: 'all' | 'customer' | 'agent';
}

/**
 * Smart profile completion analysis result
 */
export interface ProfileAnalysis {
  isComplete: boolean;
  missingFields: MissingFieldInfo[];
  completionPercentage: number;
  role: 'customer' | 'agent';
  nextRecommendedField: string | null;
}

/**
 * Detailed information about a missing field
 */
export interface MissingFieldInfo {
  field: string;
  label: string;
  description: string;
  importance: 'critical' | 'high' | 'medium';
  whyItMatters: string;
}

/**
 * ProfileCompletionService - Smart algorithm for analyzing profile completion
 *
 * This service knows exactly what fields are required for each user type
 * (customer vs agent) and provides intelligent guidance on what to fill next.
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileCompletionService {

  /**
   * Base field requirements for ALL users (both customers and agents)
   */
  private readonly baseRequirements: FieldRequirement[] = [
    {
      field: 'firstname',
      label: 'First Name',
      description: 'Your given name',
      importance: 'critical',
      whyItMatters: 'Required for identity verification, shipping labels, and communication with agents. Without it, agents cannot properly identify you.',
      applicableTo: 'all'
    },
    {
      field: 'lastname',
      label: 'Last Name',
      description: 'Your family name',
      importance: 'critical',
      whyItMatters: 'Required for identity verification and legal shipping documentation. Packages need a complete name for delivery.',
      applicableTo: 'all'
    },
    {
      field: 'phone',
      label: 'Phone Number',
      description: 'Your active mobile number',
      importance: 'critical',
      whyItMatters: 'Agents need this to contact you about pickup/delivery. Also required for delivery notifications and OTP verification.',
      applicableTo: 'all'
    },
    {
      field: 'region',
      label: 'Region',
      description: 'Your region or state',
      importance: 'critical',
      whyItMatters: 'Essential for matching you with nearby agents and calculating delivery routes. Without it, the system cannot suggest local agents.',
      applicableTo: 'all'
    },
    {
      field: 'district',
      label: 'District',
      description: 'Your district or city',
      importance: 'critical',
      whyItMatters: 'Required for precise location matching. Agents use this to determine if they can serve your area and calculate delivery costs.',
      applicableTo: 'all'
    }
  ];

  /**
   * Additional field requirements for AGENTS only
   */
  private readonly agentRequirements: FieldRequirement[] = [
    {
      field: 'base_price',
      label: 'Base Price',
      description: 'Your starting delivery price',
      importance: 'critical',
      whyItMatters: 'Customers need to know your pricing before booking. Without a base price, you will not appear in price-based searches and customers cannot estimate costs.',
      applicableTo: 'agent'
    },
    {
      field: 'price_per_km',
      label: 'Price Per Kilometer',
      description: 'Your per-km delivery rate',
      importance: 'critical',
      whyItMatters: 'Required for automatic cost calculation when customers book shipments. The system cannot generate quotes without this.',
      applicableTo: 'agent'
    },
    {
      field: 'currency',
      label: 'Currency',
      description: 'Your pricing currency (e.g., TZS, USD)',
      importance: 'critical',
      whyItMatters: 'Customers need to understand your pricing in their local currency. Without it, price comparisons are impossible.',
      applicableTo: 'agent'
    },
    {
      field: 'max_delivery_distance',
      label: 'Maximum Delivery Distance',
      description: 'How far you can deliver (in km)',
      importance: 'high',
      whyItMatters: 'The system uses this to match you with customers within your service range. Without it, you may receive requests you cannot fulfill.',
      applicableTo: 'agent'
    },
    {
      field: 'avg_delivery_time',
      label: 'Average Delivery Time',
      description: 'Typical delivery duration (e.g., "2-3 days")',
      importance: 'high',
      whyItMatters: 'Customers use this to plan their shipments. It helps you appear in time-sensitive searches like "Express Shipping".',
      applicableTo: 'agent'
    },
    {
      field: 'bio',
      label: 'Bio / Business Description',
      description: 'A short description of your services',
      importance: 'medium',
      whyItMatters: 'Builds trust with customers. Agents with detailed bios get 3x more bookings than those without.',
      applicableTo: 'agent'
    },
    {
      field: 'id_number',
      label: 'ID Number',
      description: 'Your government-issued ID number',
      importance: 'high',
      whyItMatters: 'Required for agent verification. Verified agents appear higher in search results and get a blue checkmark badge.',
      applicableTo: 'agent'
    },
    {
      field: 'specializations',
      label: 'Specializations',
      description: 'What you specialize in (e.g., express, fragile, bulk)',
      importance: 'medium',
      whyItMatters: 'Helps customers find you when searching for specific services like "Express" or "Fragile Items".',
      applicableTo: 'agent'
    },
    {
      field: 'transport_methods',
      label: 'Transport Methods',
      description: 'How you deliver (e.g., motorcycle, truck, bicycle)',
      importance: 'medium',
      whyItMatters: 'Customers want to know your delivery capacity. A motorcycle is fine for small packages; trucks for bulk.',
      applicableTo: 'agent'
    }
  ];

  /**
   * Check if a user is an agent
   */
  isAgent(user: User | null): boolean {
    if (!user) return false;
    const role = user.role?.toLowerCase();
    return role === 'agent' || role === 'seller';
  }

  /**
   * Get the role type as a string
   */
  getRole(user: User | null): 'customer' | 'agent' {
    return this.isAgent(user) ? 'agent' : 'customer';
  }

  /**
   * Analyze a user's profile and return detailed completion information
   */
  analyzeProfile(user: User | null, agentProfile: AgentProfile | null): ProfileAnalysis {
    if (!user) {
      return {
        isComplete: false,
        missingFields: [],
        completionPercentage: 0,
        role: 'customer',
        nextRecommendedField: null
      };
    }

    const role = this.getRole(user);
    const missingFields = this.getMissingFields(user, agentProfile, role);
    const totalFields = this.getAllApplicableFields(role).length;
    const completionPercentage = totalFields > 0
      ? Math.round(((totalFields - missingFields.length) / totalFields) * 100)
      : 100;

    // Determine the next recommended field (prioritize by importance)
    const nextRecommendedField = missingFields.length > 0
      ? missingFields.sort((a, b) => {
          const importanceOrder = { critical: 0, high: 1, medium: 2 };
          return importanceOrder[a.importance] - importanceOrder[b.importance];
        })[0].field
      : null;

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      completionPercentage,
      role,
      nextRecommendedField
    };
  }

  /**
   * Get all fields applicable to a given role
   */
  getAllApplicableFields(role: 'customer' | 'agent'): FieldRequirement[] {
    const base = this.baseRequirements.filter(f => f.applicableTo === 'all');
    if (role === 'agent') {
      return [...base, ...this.agentRequirements];
    }
    return base;
  }

  /**
   * Get missing fields for a user
   */
  getMissingFields(
    user: User | null,
    agentProfile: AgentProfile | null,
    role: 'customer' | 'agent'
  ): MissingFieldInfo[] {
    const missing: MissingFieldInfo[] = [];

    if (!user) return missing;

    // Check base fields (applicable to all users)
    for (const req of this.baseRequirements) {
      if (req.applicableTo === 'all' || req.applicableTo === role) {
        const value = (user as any)[req.field];
        if (!value || value === '' || value === null) {
          missing.push({
            field: req.field,
            label: req.label,
            description: req.description,
            importance: req.importance,
            whyItMatters: req.whyItMatters
          });
        }
      }
    }

    // Check agent-specific fields
    if (role === 'agent' && agentProfile) {
      for (const req of this.agentRequirements) {
        const value = (agentProfile as any)[req.field];
        // Handle arrays (specializations, transport_methods)
        if (Array.isArray(value)) {
          if (value.length === 0) {
            missing.push({
              field: req.field,
              label: req.label,
              description: req.description,
              importance: req.importance,
              whyItMatters: req.whyItMatters
            });
          }
        } else if (
          value === null ||
          value === undefined ||
          value === '' ||
          (typeof value === 'number' && value === 0)
        ) {
          missing.push({
            field: req.field,
            label: req.label,
            description: req.description,
            importance: req.importance,
            whyItMatters: req.whyItMatters
          });
        }
      }
    } else if (role === 'agent' && !agentProfile) {
      // If no agent profile exists at all, all agent fields are missing
      for (const req of this.agentRequirements) {
        missing.push({
          field: req.field,
          label: req.label,
          description: req.description,
          importance: req.importance,
          whyItMatters: req.whyItMatters
        });
      }
    }

    return missing;
  }

  /**
   * Get a user-friendly message about why profile completion is important
   */
  getCompletionMessage(role: 'customer' | 'agent'): string {
    if (role === 'agent') {
      return 'Complete your agent profile to start receiving delivery requests. Customers need to know your pricing, service area, and delivery capacity before they can book you.';
    }
    return 'Complete your profile to unlock the full platform experience. Agents need your contact details and location to process your shipments efficiently.';
  }

  /**
   * Get a short, urgent message for the popup header
   */
  getUrgentMessage(role: 'customer' | 'agent', missingCount: number): string {
    if (missingCount === 1) {
      return `Just 1 more field to complete your ${role === 'agent' ? 'agent ' : ''}profile!`;
    }
    return `You have ${missingCount} required fields missing from your ${role === 'agent' ? 'agent ' : ''}profile.`;
  }

  /**
   * Get the route for completing the profile based on role
   */
  getProfileCompletionRoute(role: 'customer' | 'agent'): string {
    if (role === 'agent') {
      return '/account/agent'; // Agent profile page
    }
    return '/account/details'; // Basic profile page
  }

  /**
   * Get a human-readable label for a field importance level
   */
  getImportanceLabel(importance: 'critical' | 'high' | 'medium'): string {
    switch (importance) {
      case 'critical':
        return 'Required';
      case 'high':
        return 'Important';
      case 'medium':
        return 'Recommended';
      default:
        return '';
    }
  }

  /**
   * Get color class for importance level
   */
  getImportanceColor(importance: 'critical' | 'high' | 'medium'): string {
    switch (importance) {
      case 'critical':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'high':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400';
    }
  }
}
