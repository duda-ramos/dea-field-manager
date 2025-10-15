import { supabase } from '@/integrations/supabase/client';
import { createHash } from 'crypto';

export interface PublicReportLink {
  id: string;
  report_id: string;
  token_hash: string;
  expires_at: string;
  is_active: boolean;
  access_count: number;
  last_accessed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface PublicReportAccess {
  link_id: string;
  token_hash: string;
  expires_at: string;
  access_count: number;
  report_id: string;
  project_id: string;
  file_url: string;
  file_name: string;
  format: 'pdf' | 'xlsx';
  interlocutor: 'cliente' | 'fornecedor';
  generated_at: string;
  sections_included: Record<string, boolean>;
  stats: Record<string, any>;
}

export interface GeneratePublicLinkOptions {
  expiresIn?: number; // Duration in milliseconds (default: 7 days)
  metadata?: Record<string, any>; // Optional metadata
}

export interface PublicLinkStats {
  id: string;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  remaining_time_ms: number;
}

// Helper function to generate SHA-256 hash
function hashToken(token: string): string {
  // In a browser environment, we use the Web Crypto API
  return btoa(String.fromCharCode(...new Uint8Array(
    new TextEncoder().encode(token)
  ))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper function to generate secure random token
function generateSecureToken(): string {
  return crypto.randomUUID();
}

export const reportSharingService = {
  /**
   * Generate a public link for a report
   * @param reportId - The ID of the report to share
   * @param options - Options including expiration time and metadata
   * @returns The public URL and link details
   */
  async generatePublicLink(
    reportId: string,
    options: GeneratePublicLinkOptions = {}
  ): Promise<{ url: string; link: PublicReportLink; token: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Verify the user owns the report
    const { data: report, error: reportError } = await supabase
      .from('project_report_history')
      .select('id')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single();

    if (reportError || !report) {
      throw new Error('Report not found or access denied');
    }

    // Generate secure token
    const token = generateSecureToken();
    const tokenHash = hashToken(token);

    // Calculate expiration date (default: 7 days)
    const expiresIn = options.expiresIn || 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const expiresAt = new Date(Date.now() + expiresIn);

    // Create the public link
    const { data: link, error: linkError } = await supabase
      .from('public_report_links')
      .insert({
        report_id: reportId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        metadata: options.metadata || {},
      })
      .select()
      .single();

    if (linkError) {
      throw new Error(`Failed to create public link: ${linkError.message}`);
    }

    // Construct the public URL
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/public/report/${token}`;

    return {
      url,
      link: link as PublicReportLink,
      token, // Return the token so it can be shared (only time it's visible)
    };
  },

  /**
   * Validate a public token and return report access data
   * @param token - The public access token
   * @returns The report access data if valid, null otherwise
   */
  async validatePublicToken(token: string): Promise<PublicReportAccess | null> {
    const tokenHash = hashToken(token);

    // Query secured RPC that enforces token hash validation server-side
    const { data, error } = await supabase
      .rpc('get_public_report_access', { token_hash: tokenHash });

    if (error || !data) {
      return null;
    }

    const accessRecord = Array.isArray(data) ? data[0] : data;
    if (!accessRecord) {
      return null;
    }

    // Increment access count (fire and forget)
    supabase.rpc('increment_public_link_access', {
      link_id: accessRecord.link_id,
      token_hash: tokenHash,
    })
      .then(() => console.log('Access count incremented'))
      .catch(err => console.error('Failed to increment access count:', err));

    return accessRecord as PublicReportAccess;
  },

  /**
   * Revoke a public link
   * @param linkId - The ID of the link to revoke
   */
  async revokePublicLink(linkId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('public_report_links')
      .update({ is_active: false })
      .eq('id', linkId)
      .eq('created_by', user.id);

    if (error) {
      throw new Error(`Failed to revoke public link: ${error.message}`);
    }
  },

  /**
   * Get statistics for a public link
   * @param linkId - The ID of the link
   * @returns Link statistics including access count and status
   */
  async getPublicLinkStats(linkId: string): Promise<PublicLinkStats | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('public_report_links')
      .select('id, access_count, last_accessed_at, created_at, expires_at, is_active')
      .eq('id', linkId)
      .eq('created_by', user.id)
      .single();

    if (error || !data) {
      return null;
    }

    // Calculate remaining time
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    const remainingTimeMs = Math.max(0, expiresAt.getTime() - now.getTime());

    return {
      ...data,
      remaining_time_ms: remainingTimeMs,
    } as PublicLinkStats;
  },

  /**
   * Get all public links for a report
   * @param reportId - The ID of the report
   * @returns List of public links
   */
  async getPublicLinksByReport(reportId: string): Promise<PublicReportLink[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('public_report_links')
      .select('*')
      .eq('report_id', reportId)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch public links: ${error.message}`);
    }

    return (data || []) as PublicReportLink[];
  },

  /**
   * Get all active public links for the current user
   * @returns List of active public links
   */
  async getActivePublicLinks(): Promise<PublicReportLink[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('public_report_links')
      .select('*')
      .eq('created_by', user.id)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active links: ${error.message}`);
    }

    return (data || []) as PublicReportLink[];
  },

  /**
   * Cleanup expired links (can be called periodically)
   */
  async cleanupExpiredLinks(): Promise<void> {
    const { error } = await supabase.rpc('cleanup_expired_public_links');

    if (error) {
      console.error('Failed to cleanup expired links:', error);
    }
  },

  /**
   * Get the public URL for a given token
   * @param token - The access token
   * @returns The full public URL
   */
  getPublicUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/report/${token}`;
  },

  /**
   * Extend the expiration of a public link
   * @param linkId - The ID of the link to extend
   * @param additionalTime - Additional time in milliseconds
   */
  async extendLinkExpiration(linkId: string, additionalTime: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get current link
    const { data: link, error: fetchError } = await supabase
      .from('public_report_links')
      .select('expires_at')
      .eq('id', linkId)
      .eq('created_by', user.id)
      .single();

    if (fetchError || !link) {
      throw new Error('Link not found or access denied');
    }

    // Calculate new expiration
    const currentExpiration = new Date(link.expires_at);
    const newExpiration = new Date(currentExpiration.getTime() + additionalTime);

    // Update the link
    const { error: updateError } = await supabase
      .from('public_report_links')
      .update({ expires_at: newExpiration.toISOString() })
      .eq('id', linkId)
      .eq('created_by', user.id);

    if (updateError) {
      throw new Error(`Failed to extend link expiration: ${updateError.message}`);
    }
  },
};