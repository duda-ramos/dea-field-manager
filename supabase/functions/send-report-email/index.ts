import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EmailRequest {
  to: string;
  reportId: string;
  publicToken: string;
  projectName: string;
  projectId: string;
  senderName?: string;
}

interface ReportStats {
  total: number;
  completed: number;
  pending: number;
  percentage: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const requestData: EmailRequest = await req.json()
    
    // Validate request
    if (!requestData.to || !isValidEmail(requestData.to)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get authorization header
    const authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check rate limiting (simple implementation)
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('sent_at', today)

    if (count && count >= 50) {
      return new Response(
        JSON.stringify({ error: 'Limite diário de emails atingido' }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Fetch project information
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name, client, address')
      .eq('id', requestData.projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      console.error('Erro ao buscar projeto:', projectError)
      return new Response(
        JSON.stringify({ error: 'Projeto não encontrado' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Fetch report statistics
    const { data: reportData, error: reportError } = await supabase
      .from('report_history')
      .select(`
        id,
        generated_at,
        created_at,
        stats,
        project_id
      `)
      .eq('id', requestData.reportId)
      .eq('project_id', requestData.projectId)
      .eq('user_id', user.id)
      .single()

    if (reportError || !reportData) {
      console.error('Erro ao buscar relatório:', reportError)
      return new Response(
        JSON.stringify({ error: 'Relatório não encontrado' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate statistics from stored report stats
    const stats = calculateReportStats(reportData.stats)
    
    // Calculate expiration date (30 days from now)
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 30)

    // Generate email HTML
    const emailHtml = generateEmailTemplate({
      projectName: project.name,
      projectClient: project.client,
      projectAddress: project.address,
      senderName: requestData.senderName,
      stats,
      publicToken: requestData.publicToken,
      expirationDate: expirationDate.toLocaleDateString('pt-BR'),
      reportDate: getReportDate(reportData).toLocaleDateString('pt-BR')
    })

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY não configurada')
      return new Response(
        JSON.stringify({ error: 'Serviço de email não configurado' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DEA Manager <noreply@resend.dev>',
        to: requestData.to,
        subject: `Relatório de Instalações - ${project.name}`,
        html: emailHtml
      })
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.text()
      console.error('Erro ao enviar email:', error)
      
      // Log failed attempt
      await supabase.from('email_logs').insert({
        user_id: user.id,
        recipient_email: requestData.to,
        report_id: requestData.reportId,
        success: false,
        error_message: error
      })

      return new Response(
        JSON.stringify({ error: 'Erro ao enviar email' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Log successful email
    await supabase.from('email_logs').insert({
      user_id: user.id,
      recipient_email: requestData.to,
      report_id: requestData.reportId,
      success: true
    })

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro na edge function:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

function calculateReportStats(rawStats: unknown): ReportStats {
  const defaultStats: ReportStats = { total: 0, completed: 0, pending: 0, percentage: 0 }

  if (!rawStats) {
    return defaultStats
  }

  let statsRecord: Record<string, unknown> | null = null

  if (typeof rawStats === 'string') {
    try {
      const parsed = JSON.parse(rawStats)
      if (parsed && typeof parsed === 'object') {
        statsRecord = parsed as Record<string, unknown>
      }
    } catch (error) {
      console.warn('Failed to parse stats JSON string', error)
      return defaultStats
    }
  } else if (typeof rawStats === 'object') {
    statsRecord = rawStats as Record<string, unknown>
  }

  if (!statsRecord) {
    return defaultStats
  }

  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    return null
  }

  const total = toNumber(statsRecord.total) ?? toNumber(statsRecord.total_items) ?? defaultStats.total
  const completed =
    toNumber(statsRecord.completed) ??
    toNumber(statsRecord.concluidas) ??
    toNumber(statsRecord.concluidos) ??
    defaultStats.completed

  const pendingDirect =
    toNumber(statsRecord.pending) ??
    toNumber(statsRecord.pendencias) ??
    toNumber(statsRecord.pendentes)

  const inProgress = toNumber(statsRecord.inProgress) ?? toNumber(statsRecord.emAndamento) ?? 0
  const inReview = toNumber(statsRecord.inReview) ?? toNumber(statsRecord.emRevisao) ?? 0

  let pending = pendingDirect ?? 0

  if (pendingDirect == null) {
    const derivedPending = (toNumber(statsRecord.pendencias) ?? 0) + inProgress + inReview
    if (derivedPending > 0) {
      pending = derivedPending
    }
  }

  if (pending <= 0 && total > 0) {
    const fallbackPending = total - completed - inReview
    if (fallbackPending > 0) {
      pending = fallbackPending
    }
  }

  if (pending < 0) {
    pending = 0
  }

  const percentage =
    toNumber(statsRecord.percentage) ??
    (total > 0 ? Math.round((completed / total) * 100) : defaultStats.percentage)

  return {
    total,
    completed,
    pending,
    percentage
  }
}

function getReportDate(reportData: { generated_at?: string | null; created_at?: string | null }): Date {
  const generatedAt = reportData.generated_at ? new Date(reportData.generated_at) : null
  if (generatedAt && !Number.isNaN(generatedAt.getTime())) {
    return generatedAt
  }

  const createdAt = reportData.created_at ? new Date(reportData.created_at) : null
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    return createdAt
  }

  return new Date()
}

function generateEmailTemplate(params: {
  projectName: string;
  projectClient?: string;
  projectAddress?: string;
  senderName?: string;
  stats: ReportStats;
  publicToken: string;
  expirationDate: string;
  reportDate: string;
}): string {
  const appDomain = Deno.env.get('APP_DOMAIN') || 'https://deamanager.com'
  const reportUrl = `${appDomain}/public/report/${params.publicToken}`
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Relatório de Instalações - ${params.projectName}</title>
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Base styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 100% !important;
      min-width: 100%;
      background-color: #f3f4f6;
      color: #1f2937;
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body { background-color: #111827 !important; }
      .email-container { background-color: #1f2937 !important; }
      .header-section { background-color: #374151 !important; }
      .content-section { color: #e5e7eb !important; }
      .stat-card { background-color: #374151 !important; border-color: #4b5563 !important; }
      .info-card { background-color: #374151 !important; border-color: #4b5563 !important; }
      h1, h2, h3, p { color: #e5e7eb !important; }
      .text-secondary { color: #9ca3af !important; }
      .warning-box { background-color: #374151 !important; border-color: #4b5563 !important; }
    }
    
    /* Container styles */
    .email-wrapper {
      background-color: #f3f4f6;
      padding: 20px 0;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    
    /* Header styles */
    .header-section {
      background-color: #4f46e5;
      padding: 32px 24px;
      text-align: center;
    }
    
    .header-title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    
    /* Content styles */
    .content-section {
      padding: 32px 24px;
    }
    
    .greeting {
      font-size: 20px;
      color: #1f2937;
      margin: 0 0 8px 0;
      font-weight: 600;
    }
    
    .subtitle {
      font-size: 24px;
      color: #1f2937;
      margin: 8px 0 24px 0;
      font-weight: 700;
      line-height: 1.3;
    }
    
    /* Info card */
    .info-card {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .info-label {
      font-weight: 600;
      color: #6b7280;
      font-size: 14px;
    }
    
    .info-value {
      color: #1f2937;
      font-size: 14px;
      font-weight: 500;
      text-align: right;
    }
    
    /* Statistics section */
    .stats-container {
      margin: 32px 0;
      text-align: center;
    }
    
    .stats-grid {
      display: inline-block;
      margin: 0 auto;
    }
    
    .stat-card {
      display: inline-block;
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin: 8px;
      min-width: 120px;
      vertical-align: top;
    }
    
    .stat-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin: 4px 0;
    }
    
    .stat-label {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }
    
    /* CTA Button */
    .cta-container {
      text-align: center;
      margin: 40px 0;
    }
    
    .cta-button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 16px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: background-color 0.2s;
    }
    
    .cta-button:hover {
      background-color: #4338ca;
    }
    
    /* Warning box */
    .warning-box {
      background-color: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      text-align: center;
    }
    
    .warning-text {
      color: #92400e;
      font-size: 14px;
      margin: 0;
    }
    
    /* Footer */
    .footer-section {
      background-color: #f9fafb;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-text {
      color: #6b7280;
      font-size: 14px;
      margin: 0;
    }
    
    /* Mobile styles */
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 0 !important; }
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .header-section { padding: 24px 16px !important; }
      .header-title { font-size: 24px !important; }
      .content-section { padding: 24px 16px !important; }
      .subtitle { font-size: 20px !important; }
      .stat-card { 
        display: block !important; 
        width: calc(100% - 32px) !important;
        margin: 8px 0 !important;
      }
      .info-row {
        flex-direction: column;
        text-align: left;
      }
      .info-value {
        text-align: left;
        margin-top: 4px;
      }
      .cta-button { 
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="header-section">
        <h1 class="header-title">📊 DEA Manager</h1>
      </div>
      
      <!-- Content -->
      <div class="content-section">
        <h2 class="greeting">Olá${params.senderName ? `, ${params.senderName}` : ''}!</h2>
        <h3 class="subtitle">Seu Relatório de Instalações está pronto</h3>
        
        <!-- Project Info -->
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">📁 Projeto</span>
            <span class="info-value">${params.projectName}</span>
          </div>
          ${params.projectClient ? `
          <div class="info-row">
            <span class="info-label">👤 Cliente</span>
            <span class="info-value">${params.projectClient}</span>
          </div>
          ` : ''}
          ${params.projectAddress ? `
          <div class="info-row">
            <span class="info-label">📍 Endereço</span>
            <span class="info-value">${params.projectAddress}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">📅 Data do Relatório</span>
            <span class="info-value">${params.reportDate}</span>
          </div>
        </div>
        
        <!-- Statistics -->
        <div class="stats-container">
          <h3 style="color: #1f2937; margin-bottom: 24px;">Resumo do Progresso</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">✅</div>
              <div class="stat-value" style="color: #10b981;">${params.stats.completed}</div>
              <p class="stat-label">Concluídos</p>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">⏳</div>
              <div class="stat-value" style="color: #f59e0b;">${params.stats.pending}</div>
              <p class="stat-label">Pendentes</p>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-value" style="color: #3b82f6;">${params.stats.percentage}%</div>
              <p class="stat-label">Progresso</p>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">📦</div>
              <div class="stat-value">${params.stats.total}</div>
              <p class="stat-label">Total de Itens</p>
            </div>
          </div>
        </div>
        
        <!-- CTA Button -->
        <div class="cta-container">
          <a href="${reportUrl}" class="cta-button">
            Visualizar Relatório Completo
          </a>
        </div>
        
        <!-- Warning -->
        <div class="warning-box">
          <p class="warning-text">
            🔒 Este link expira em <strong>${params.expirationDate}</strong>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer-section">
        <p class="footer-text">
          Relatório gerado por <strong>DEA Manager</strong><br>
          <span style="font-size: 12px; color: #9ca3af;">
            Sistema de Gestão de Instalações Elétricas
          </span>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}