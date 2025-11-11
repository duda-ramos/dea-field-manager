import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/logger';
import type { Json, Tables } from '@/integrations/supabase/types';

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

const mapMetadata = (metadata: Json | null | undefined): Record<string, any> => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, any>;
  }
  return {};
};

const toJsonMetadata = (metadata?: Record<string, any>): Json =>
  JSON.parse(JSON.stringify(metadata ?? {}));

const mapPublicReportLink = (link: Tables<'public_report_links'>): PublicReportLink => ({
  id: link.id,
  report_id: link.report_id,
  token_hash: link.token_hash,
  expires_at: link.expires_at,
  is_active: link.is_active,
  access_count: link.access_count,
  last_accessed_at: link.last_accessed_at,
  created_by: link.created_by,
  created_at: link.created_at,
  updated_at: link.updated_at,
  metadata: mapMetadata(link.metadata),
});

const mapPublicReportAccess = (
  access: Tables<'public_report_access'>
): PublicReportAccess => ({
  link_id: access.link_id,
  token_hash: access.token_hash,
  expires_at: access.expires_at,
  access_count: access.access_count,
  report_id: access.report_id,
  project_id: access.project_id,
  file_url: access.file_url,
  file_name: access.file_name,
  format: access.format as 'pdf' | 'xlsx',
  interlocutor: access.interlocutor as 'cliente' | 'fornecedor',
  generated_at: access.generated_at,
  sections_included: Object.fromEntries(
    Object.entries(mapMetadata(access.sections_included)).map(([key, value]) => [
      key,
      Boolean(value),
    ])
  ) as Record<string, boolean>,
  stats: mapMetadata(access.stats),
});

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
    let reportFound = false;

    const { data: newReport, error: newReportError } = await supabase
      .from('report_history')
      .select('id')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single();

    if (newReport && !newReportError) {
      reportFound = true;
    } else if (newReportError && newReportError.code !== 'PGRST116') {
      throw new Error(`Failed to verify report ownership: ${newReportError.message}`);
    }

    // Report not found in report_history table

    if (!reportFound) {
      const { data: legacyReport, error: legacyReportError } = await supabase
        .from('project_report_history')
        .select('id')
        .eq('id', reportId)
        .eq('user_id', user.id)
        .single();

      if (legacyReport && !legacyReportError) {
        reportFound = true;
      } else if (legacyReportError && legacyReportError.code !== 'PGRST116') {
        throw new Error(`Failed to verify report ownership: ${legacyReportError.message}`);
      }
    }

    if (!reportFound) {
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
        metadata: toJsonMetadata(options.metadata),
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
      link: mapPublicReportLink(link),
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

    // Increment access count (fire and forget - no await)
    void (async () => {
      try {
        await supabase.rpc('increment_public_link_access', {
          link_id: accessRecord.link_id,
          token_hash: tokenHash,
        });
      } catch (err) {
        // Access count increment error - non-critical, just log
        logger.error('Failed to increment access count', { error: err, linkId: accessRecord.link_id });
      }
    })();

    return mapPublicReportAccess(accessRecord as Tables<'public_report_access'>);
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
      id: data.id,
      access_count: data.access_count,
      last_accessed_at: data.last_accessed_at,
      created_at: data.created_at,
      expires_at: data.expires_at,
      is_active: data.is_active,
      remaining_time_ms: remainingTimeMs,
    };
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

    return (data || []).map(mapPublicReportLink);
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

    return (data || []).map(mapPublicReportLink);
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

  /**
   * Send report by email
   * @param params - Email parameters including recipient, report details, etc.
   * @returns Success status and error message if applicable
   */
  async sendReportByEmail(params: {
    to: string;
    reportId: string;
    publicToken: string;
    projectName: string;
    projectId: string;
    senderName?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate email format
      if (!isValidEmail(params.to)) {
        return { 
          success: false, 
          error: 'Formato de email inválido' 
        };
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { 
          success: false, 
          error: 'Usuário não autenticado' 
        };
      }

      // Call edge function to send email
      const { error } = await supabase.functions.invoke('send-report-email', {
        body: params
      });

      if (error) {
        console.error('Erro ao enviar email:', error);
        
        // Handle specific error types
        if (error.message?.includes('429')) {
          return { 
            success: false, 
            error: 'Limite de envios atingido. Tente mais tarde.' 
          };
        }
        
        if (error.message?.includes('401')) {
          return { 
            success: false, 
            error: 'Não autorizado' 
          };
        }

        return { 
          success: false, 
          error: error.message || 'Erro ao enviar email. Tente novamente.' 
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao enviar email:', error);
      
      // Handle network errors
      if (!navigator.onLine) {
        return { 
          success: false, 
          error: 'Sem conexão. Verifique sua internet.' 
        };
      }

      return { 
        success: false, 
        error: error.message || 'Erro ao enviar email' 
      };
    }
  },
};

/**
 * Helper function to validate email format
 * @param email - The email address to validate
 * @returns true if valid, false otherwise
 */
function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}