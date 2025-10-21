import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schemas
const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name too long'),
  client: z.string().trim().min(1, 'Client is required').max(200, 'Client name too long'),
  city: z.string().trim().min(1, 'City is required').max(100, 'City name too long'),
  code: z.string().trim().max(50, 'Code too long').optional(),
  status: z.enum(['planning', 'in_progress', 'completed', 'on_hold']).optional(),
})

const _CreateInstallationSchema = z.object({
  codigo: z.number().int().positive('Codigo must be positive'),
  descricao: z.string().trim().min(1, 'Description is required').max(500, 'Description too long'),
  tipologia: z.string().trim().min(1, 'Type is required').max(100, 'Type too long'),
  pavimento: z.string().trim().min(1, 'Floor is required').max(50, 'Floor too long'),
  quantidade: z.number().int().positive('Quantity must be positive'),
  installed: z.boolean().optional(),
})

interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          client: string
          city: string
          code: string
          status: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          client: string
          city: string
          code?: string
          status?: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          client?: string
          city?: string
          code?: string
          status?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      installations: {
        Row: {
          id: string
          project_id: string
          codigo: number
          descricao: string
          tipologia: string
          pavimento: string
          quantidade: number
          installed: boolean
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          codigo: number
          descricao: string
          tipologia: string
          pavimento: string
          quantidade: number
          installed?: boolean
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          codigo?: number
          descricao?: string
          tipologia?: string
          pavimento?: string
          quantidade?: number
          installed?: boolean
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          user_id: string
          name: string
          key_hash: string
          permissions: any
          is_active: boolean
          last_used_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          key_hash: string
          permissions: any
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          key_hash?: string
          permissions?: any
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [key: string]: unknown
    }
    Functions: {
      [key: string]: unknown
    }
    Enums: {
      [key: string]: unknown
    }
    CompositeTypes: {
      [key: string]: unknown
    }
  }
}

// Narrow type for api_keys selection used in authentication
interface ApiKeyData {
  id: string
  user_id: string
  key_hash: string
  permissions: any
  is_active: boolean
  expires_at: string | null
}

function isApiKeyData(value: unknown): value is ApiKeyData {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  const hasRequiredStrings =
    typeof candidate.id === 'string' &&
    typeof candidate.user_id === 'string' &&
    typeof candidate.key_hash === 'string'
  const hasActiveFlag = typeof candidate.is_active === 'boolean'
  const hasValidExpiry =
    !('expires_at' in candidate) ||
    typeof candidate.expires_at === 'string' ||
    candidate.expires_at === null
  return hasRequiredStrings && hasActiveFlag && hasValidExpiry
}

// Using runtime validation via type guards for api_keys rows

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Hash API key function using bcrypt (secure)
async function _hashKey(key: string): Promise<string> {
  // Use bcrypt with salt rounds of 12 for security
  return await bcrypt.hash(key, "12")
}

/**
 * Verifies API key against bcrypt hash
 * Returns false on any error to fail securely
 */
async function verifyKey(key: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(key, hash)
  } catch (_error) {
    return false
  }
}

/**
 * Authenticates API key from Authorization header
 * Uses bcrypt to securely compare keys against hashed values
 * Updates last_used_at timestamp for valid keys
 */
async function authenticateApiKey(authHeader: string | null): Promise<{ user_id: string; permissions: any; api_key_id: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const apiKey = authHeader.substring(7)
  
  // Validate API key format (minimum 32 characters for security)
  if (apiKey.length < 32) {
    return null
  }

  // Get all active API keys for comparison
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash, permissions, is_active, expires_at')
    .eq('is_active', true)

  if (error || !apiKeys || apiKeys.length === 0) {
    return null
  }

  // Find matching key by comparing hashes
  for (const keyData of apiKeys) {
    if (!isApiKeyData(keyData)) continue

    const isMatch = await verifyKey(apiKey, keyData.key_hash)

    if (isMatch) {
      // Check if key is expired
      const expiresAt = keyData.expires_at
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return null
      }

      // Update last used timestamp
      try {
        await supabase
          .from('api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', keyData.id)
      } catch (_updateError) {
        // Ignore update errors to avoid blocking authentication
      }

      return {
        user_id: keyData.user_id,
        permissions: keyData.permissions,
        api_key_id: keyData.id,
      }
    }
  }

  return null
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/public-api', '')
    const method = req.method

    // Authenticate request
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing API key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // API Documentation endpoint
    if (path === '/docs' && method === 'GET') {
      const docs = {
        title: 'Project Management API',
        version: '1.0.0',
        description: 'API para gerenciamento de projetos e instalações',
        endpoints: {
          'GET /projects': 'Listar projetos do usuário',
          'POST /projects': 'Criar novo projeto',
          'GET /projects/:id': 'Obter projeto específico',
          'PUT /projects/:id': 'Atualizar projeto',
          'DELETE /projects/:id': 'Deletar projeto',
          'GET /projects/:id/installations': 'Listar instalações do projeto',
          'POST /projects/:id/installations': 'Criar nova instalação',
          'GET /installations/:id': 'Obter instalação específica',
          'PUT /installations/:id': 'Atualizar instalação',
          'DELETE /installations/:id': 'Deletar instalação'
        },
        authentication: {
          type: 'Bearer Token',
          header: 'Authorization: Bearer YOUR_API_KEY'
        },
        errors: {
          400: 'Bad Request - Dados inválidos',
          401: 'Unauthorized - API key inválida',
          403: 'Forbidden - Permissão insuficiente',
          404: 'Not Found - Recurso não encontrado',
          500: 'Internal Server Error - Erro do servidor'
        }
      }

      return new Response(
        JSON.stringify(docs, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Projects endpoints
    if (path === '/projects' && method === 'GET') {
      if (!auth.permissions.read) {
        return new Response(
          JSON.stringify({ error: 'Read permission required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client, city, code, status, created_at, updated_at')
        .eq('user_id', auth.user_id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (path === '/projects' && method === 'POST') {
      if (!auth.permissions.write) {
        return new Response(
          JSON.stringify({ error: 'Write permission required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      
      // Validate input with Zod
      const validation = CreateProjectSchema.safeParse(body)
      if (!validation.success) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid input', 
            details: validation.error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { name, client, city, code, status } = validation.data

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          client,
          city,
          code: code || '',
          status: status || 'planning',
          user_id: auth.user_id
        } as any)
        .select()
        .maybeSingle()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Project by ID endpoints
    const projectMatch = path.match(/^\/projects\/([^/]+)$/)
    if (projectMatch && method === 'GET') {
      if (!auth.permissions.read) {
        return new Response(
          JSON.stringify({ error: 'Read permission required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const projectId = projectMatch[1]
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', auth.user_id)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Project not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Installations endpoints
    const installationsMatch = path.match(/^\/projects\/([^/]+)\/installations$/)
    if (installationsMatch && method === 'GET') {
      if (!auth.permissions.read) {
        return new Response(
          JSON.stringify({ error: 'Read permission required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const projectId = installationsMatch[1]
      
      // Verify project ownership
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', auth.user_id)
        .single()

      if (!project) {
        return new Response(
          JSON.stringify({ error: 'Project not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('installations')
        .select('id, codigo, descricao, tipologia, pavimento, quantidade, installed, created_at, updated_at')
        .eq('project_id', projectId)
        .eq('user_id', auth.user_id)
        .order('codigo', { ascending: true })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Default 404 response
    return new Response(
      JSON.stringify({ 
        error: 'Endpoint not found',
        available_endpoints: [
          'GET /docs - API documentation',
          'GET /projects - List projects',
          'POST /projects - Create project',
          'GET /projects/:id - Get project',
          'GET /projects/:id/installations - List installations'
        ]
      }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (_error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})