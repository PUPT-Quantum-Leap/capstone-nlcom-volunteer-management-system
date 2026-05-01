import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface StoredInviteInfo {
  token: string;
  role: string;
  email: string;
  timestamp: string;
}

/**
 * Supabase Service
 *
 * Provides Supabase client and authentication utilities.
 * Handles auth state changes, session management, and invite token storage.
 */
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private router = inject(Router);

  // Storage key for pending invites
  private readonly PENDING_INVITE_KEY = 'pending_invite';

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );

    // Set up auth state change listener
    this.setupAuthListener();
  }

  get client() {
    return this.supabase;
  }

  /**
   * Set up auth state change listener to handle auth events
   */
  private setupAuthListener(): void {
    this.supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log('Supabase auth state changed:', event, session?.user?.email);

      switch (event) {
        case 'SIGNED_IN':
          // User signed in via magic link or OAuth
          // The callback component will handle the redirect
          break;
        case 'SIGNED_OUT':
          // Clear any stored invite info on sign out
          this.clearStoredInvite();
          break;
        case 'USER_UPDATED':
          // User data updated (e.g., after password change)
          break;
        case 'TOKEN_REFRESHED':
          // Session token refreshed
          break;
      }
    });
  }

  /**
   * Store invite information in localStorage before redirecting to Supabase auth
   * This allows us to remember where to redirect the user after they authenticate
   */
  storeInviteForCallback(token: string, role: string, email: string): void {
    try {
      const inviteInfo: StoredInviteInfo = {
        token,
        role,
        email,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem(this.PENDING_INVITE_KEY, JSON.stringify(inviteInfo));
      console.log('Invite info stored for callback', { role, email });
    } catch (error) {
      console.error('Failed to store invite info', error);
    }
  }

  /**
   * Retrieve stored invite information from localStorage
   */
  getStoredInvite(): StoredInviteInfo | null {
    try {
      const stored = localStorage.getItem(this.PENDING_INVITE_KEY);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as StoredInviteInfo;

      // Check if invite has expired (7 days)
      if (parsed['timestamp']) {
        const storedTime = new Date(parsed['timestamp']).getTime();
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (now - storedTime > sevenDays) {
          this.clearStoredInvite();
          return null;
        }
      }

      return parsed;
    } catch (error) {
      console.error('Error reading stored invite', error);
      this.clearStoredInvite();
      return null;
    }
  }

  /**
   * Clear stored invite information from localStorage
   */
  clearStoredInvite(): void {
    localStorage.removeItem(this.PENDING_INVITE_KEY);
  }

  /**
   * Get the current Supabase session
   */
  async getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
    return this.supabase.auth.getSession();
  }

  /**
   * Get the current authenticated user
   */
  async getUser(): Promise<{ data: { user: Session['user'] | null }; error: Error | null }> {
    return this.supabase.auth.getUser();
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<{ error: Error | null }> {
    this.clearStoredInvite();
    return this.supabase.auth.signOut();
  }

  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await this.getSession();
    return !!session;
  }

  /**
   * Get role from user metadata (stored during invite)
   */
  getUserRole(user: Session['user'] | null): string | null {
    if (!user) return null;
    const metadata = user.user_metadata as Record<string, string> | undefined;
    return metadata?.['role'] || null;
  }
}
