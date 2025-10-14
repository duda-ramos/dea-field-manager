import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { provider } = await req.json()
    
    // Get user from JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's storage integration
    const { data: integration, error: integrationError } = await supabase
      .from('storage_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Storage integration not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Simulate sync process (in real implementation, would call external APIs)
    console.log(`Starting sync for provider: ${provider}`)
    console.log(`User: ${user.id}`)
    console.log(`Integration config:`, integration.config)

    // Simulate different sync scenarios based on provider
    let syncResult
    switch (provider) {
      case 'google_drive':
        syncResult = await syncGoogleDrive(integration.config, user.id)
        break
      case 'dropbox':
        syncResult = await syncDropbox(integration.config, user.id)
        break
      case 'onedrive':
        syncResult = await syncOneDrive(integration.config, user.id)
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    // Log activity
    await supabase
      .from('project_activities')
      .insert([{
        project_id: 'global', // Global activity
        user_id: user.id,
        action: 'external_storage_sync',
        details: {
          provider,
          files_synced: syncResult.files_synced,
          sync_duration: syncResult.duration
        }
      }])

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        ...syncResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function syncGoogleDrive(_config: any, _userId: string) {
  console.log('Syncing with Google Drive...')
  
  // Simulate API calls and file processing
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  return {
    files_synced: Math.floor(Math.random() * 50) + 10,
    folders_created: Math.floor(Math.random() * 5) + 1,
    duration: '2.1s',
    last_sync: new Date().toISOString(),
    provider_specific: {
      quota_used: '1.2 GB',
      quota_total: '15 GB'
    }
  }
}

async function syncDropbox(_config: any, _userId: string) {
  console.log('Syncing with Dropbox...')
  
  // Simulate API calls and file processing
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  return {
    files_synced: Math.floor(Math.random() * 30) + 5,
    folders_created: Math.floor(Math.random() * 3) + 1,
    duration: '1.5s',
    last_sync: new Date().toISOString(),
    provider_specific: {
      shared_folders: 2,
      file_versions: 15
    }
  }
}

async function syncOneDrive(_config: any, _userId: string) {
  console.log('Syncing with OneDrive...')
  
  // Simulate API calls and file processing
  await new Promise(resolve => setTimeout(resolve, 1800))
  
  return {
    files_synced: Math.floor(Math.random() * 40) + 8,
    folders_created: Math.floor(Math.random() * 4) + 1,
    duration: '1.8s',
    last_sync: new Date().toISOString(),
    provider_specific: {
      office_docs: 12,
      storage_used: '850 MB'
    }
  }
}