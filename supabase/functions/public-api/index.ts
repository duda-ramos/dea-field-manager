import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      }
    }
  }
}

const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Hash API key function
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Authenticate API key
async function authenticateApiKey(authHeader: string | null): Promise<{ user_id: string; permissions: any } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const apiKey = authHeader.substring(7)
  const keyHash = await hashKey(apiKey)

  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('user_id, permissions, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error || !keyData || !keyData.is_active) {
    return null
  }

  // Check if key is expired
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return null
  }

  // Update last used timestamp
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)

  return {
    user_id: keyData.user_id,
    permissions: keyData.permissions
  }
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
      const { name, client, city, code, status } = body

      if (!name || !client || !city) {
        return new Response(
          JSON.stringify({ error: 'Name, client, and city are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          client,
          city,
          code: code || '',
          status: status || 'planning',
          user_id: auth.user_id
        })
        .select()
        .maybeSingle()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Project by ID endpoints
    const projectMatch = path.match(/^\/projects\/([^\/]+)$/)
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
    const installationsMatch = path.match(/^\/projects\/([^\/]+)\/installations$/)
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

  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})