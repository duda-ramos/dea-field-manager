import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Project, Installation, ItemVersion } from '@/types';
import type { ReportConfig } from '@/components/reports/ReportCustomizationModal.types';
import { storage } from './storage';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string;

/**
 * Upload report file to Supabase Storage and save metadata to database
 * 
 * @param blob - Report file blob
 * @param projectId - Project ID
 * @param format - Report format ('pdf' or 'xlsx')
 * @param config - Report configuration
 * @param data - Optional report data for stats calculation
 * @returns Promise<{ fileUrl: string; fileName: string } | null>
 */
export async function saveReportToSupabase(
  blob: Blob,
  projectId: string,
  format: 'pdf' | 'xlsx',
  config: ReportConfig,
  data?: ReportData
): Promise<{ fileUrl: string; fileName: string } | null> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[saveReportToSupabase] User not authenticated');
      return null;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const fileName = `report-${projectId}-${timestamp}.${extension}`;
    const filePath = `${user.id}/${projectId}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, blob, {
        contentType: format === 'pdf' 
          ? 'application/pdf' 
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false
      });

    if (uploadError) {
      console.error('[saveReportToSupabase] Upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('reports')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      console.error('[saveReportToSupabase] Failed to get public URL');
      return null;
    }

    // Calculate stats from data if provided, otherwise use config stats
    let stats = config?.stats || {};
    if (data) {
      const sections = calculateReportSections(data);
      stats = {
        pendencias: sections.pendencias.length,
        concluidas: sections.concluidas.length,
        emRevisao: sections.emRevisao.length,
        emAndamento: sections.emAndamento.length,
        total: sections.pendencias.length + sections.concluidas.length + 
               sections.emRevisao.length + sections.emAndamento.length
      };
    }

    // Save metadata to database (non-blocking)
    try {
      const { error: dbError } = await supabase
        .from('report_history')
        .insert({
          project_id: projectId,
          user_id: user.id,
          format,
          config: config || {},
          file_url: urlData.publicUrl,
          file_name: fileName,
          interlocutor: config?.interlocutor || 'cliente',
          generated_by: user.id,
          generated_at: new Date().toISOString(),
          sections_included: config?.sections || {},
          stats
        });

      if (dbError) {
        console.warn('⚠️ Failed to save metadata (file is safe):', dbError);
      }
    } catch (metadataError) {
      // Don't break the flow if metadata save fails
      console.warn('⚠️ Failed to save metadata (file is safe):', metadataError);
    }

    return {
      fileUrl: urlData.publicUrl,
      fileName
    };
  } catch (error) {
    logger.error('Falha ao salvar relatório no Supabase', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        projectId,
        format,
        blobSize: blob.size,
        userId: undefined, // Will be logged in context above
        operacao: 'saveReportToSupabase',
        timestamp: new Date().toISOString()
      }
    });
    return null;
  }
}

export interface ReportData {
  project: Project;
  installations: Installation[];
  versions: ItemVersion[];
  generatedBy: string;
  generatedAt: string;
  interlocutor: 'cliente' | 'fornecedor';
}

export interface ReportSections {
  pendencias: Installation[];
  concluidas: Installation[];
  emRevisao: Installation[];
  emAndamento: Installation[];
}

export interface PavimentoSummary {
  pavimento: string;
  pendentes: number;
  instalados: number;
  emRevisao: number;
  emAndamento: number;
  total: number;
}

// Report theme for consistent styling - MODERNIZED
export const reportTheme = {
  colors: {
    // Semantic colors
    pendentes: '#F59E0B',
    instalados: '#10B981', 
    emAndamento: '#6B7280',
    revisao: '#8B5CF6',
    restante: '#E5E7EB',
    
    // Primary brand color (modern blue)
    primary: [37, 99, 235] as [number, number, number], // #2563EB
    primaryLight: [219, 234, 254] as [number, number, number], // #DBEAFE
    
    // Neutral palette
    header: [30, 41, 59] as [number, number, number], // #1E293B - Darker for contrast
    headerText: [255, 255, 255] as [number, number, number],
    alternateRow: [248, 250, 252] as [number, number, number], // #F8FAFC - Subtle
    border: [226, 232, 240] as [number, number, number], // #E2E8F0
    divider: '#CBD5E1',
    footer: '#64748B',
    
    // Card backgrounds
    cardBg: [249, 250, 251] as [number, number, number], // #F9FAFB
    cardBorder: [229, 231, 235] as [number, number, number], // #E5E7EB
    
    // Status badge colors
    success: { bg: [220, 252, 231] as [number, number, number], text: [22, 101, 52] as [number, number, number] }, // Green
    warning: { bg: [254, 243, 199] as [number, number, number], text: [146, 64, 14] as [number, number, number] }, // Amber
    info: { bg: [224, 231, 255] as [number, number, number], text: [55, 48, 163] as [number, number, number] }, // Blue
    neutral: { bg: [243, 244, 246] as [number, number, number], text: [55, 65, 81] as [number, number, number] } // Gray
  },
  fonts: {
    title: 24,
    subtitle: 16,
    sectionTitle: 14,
    text: 10,
    small: 9,
    footer: 8
  },
  spacing: {
    margin: 20,
    titleBottom: 12,
    subtitleTop: 15,
    subtitleBottom: 8,
    sectionSpacing: 10,
    cardPadding: 4
  }
};

// Calculate report sections based on interlocutor
export function calculateReportSections(data: ReportData): ReportSections {
  const { installations, interlocutor } = data;
  
  const pendencias: Installation[] = [];
  const concluidas: Installation[] = [];
  const emRevisao: Installation[] = [];
  const emAndamento: Installation[] = [];

  installations.forEach(item => {
    // Check if item is in revision (revisao > 1)
    if (item.revisao > 1) {
      emRevisao.push(item);
      return;
    }

    // Check pending conditions based on interlocutor and new pendency fields
    const hasPendingCondition = item.pendencia_tipo || 
      (interlocutor === 'cliente' 
        ? !!item.observacoes 
        : !!(item.observacoes || item.comentarios_fornecedor));

    if (hasPendingCondition) {
      pendencias.push(item);
    } else if (item.installed) {
      concluidas.push(item);
    } else {
      emAndamento.push(item);
    }
  });

  return { pendencias, concluidas, emRevisao, emAndamento };
}

// Calculate pavimento summary
export function calculatePavimentoSummary(data: ReportSections): PavimentoSummary[] {
  const pavimentoMap = new Map<string, PavimentoSummary>();
  
  const allItems = [...data.pendencias, ...data.concluidas, ...data.emRevisao, ...data.emAndamento];
  
  allItems.forEach(item => {
    if (!pavimentoMap.has(item.pavimento)) {
      pavimentoMap.set(item.pavimento, {
        pavimento: item.pavimento,
        pendentes: 0,
        instalados: 0,
        emRevisao: 0,
        emAndamento: 0,
        total: 0
      });
    }
    
    const summary = pavimentoMap.get(item.pavimento)!;
    
    if (data.pendencias.includes(item)) summary.pendentes++;
    else if (data.concluidas.includes(item)) summary.instalados++;
    else if (data.emRevisao.includes(item)) summary.emRevisao++;
    else if (data.emAndamento.includes(item)) summary.emAndamento++;
    
    summary.total++;
  });
  
  return Array.from(pavimentoMap.values()).sort((a, b) => 
    a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true })
  );
}

/**
 * Generate iPhone-style storage bar chart (100% stacked)
 * 
 * @param data - Report sections with installation counts
 * @returns Promise<string> - Data URL of chart image, or empty string if generation fails
 * 
 * Error Handling:
 * - Returns empty string if canvas context fails
 * - Handles empty data gracefully
 * - Cleans up canvas to prevent memory leaks
 * - Never throws - allows report to continue without chart
 * 
 * PERFORMANCE: Added canvas cleanup to prevent memory leaks
 */
export async function generateStorageBarImage(data: ReportSections): Promise<string> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      // Higher resolution for crisp PDF export
      const scale = 2;
      canvas.width = 800 * scale;
      canvas.height = 120 * scale;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('[generateStorageBarImage] Failed to get canvas context');
        canvas.remove(); // Cleanup
        resolve('');
        return;
      }

    // Scale context for high DPI
    ctx.scale(scale, scale);

    // Calculate totals (excluding Em Revisão from charts)
    const total = data.pendencias.length + data.concluidas.length + data.emAndamento.length;
    if (total === 0) {
      // Draw empty bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 120);
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      canvas.remove(); // Cleanup to prevent memory leak
      resolve(dataUrl);
      return;
    }

    // Modern gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#f8fafc');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 120);

    // Calculate percentages
    const instaladosPercent = (data.concluidas.length / total) * 100;
    const pendentesPercent = (data.pendencias.length / total) * 100;
    const emAndamentoPercent = (data.emAndamento.length / total) * 100;

    // Storage bar configuration with shadow
    const barX = 40;
    const barY = 30;
    const barWidth = 720;
    const barHeight = 24;
    const borderRadius = 12;

    // Draw shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;

    // Draw the main storage bar
    drawStorageBar(ctx, barX, barY, barWidth, barHeight, borderRadius, {
      instalados: { value: data.concluidas.length, color: reportTheme.colors.instalados },
      pendentes: { value: data.pendencias.length, color: reportTheme.colors.pendentes },
      emAndamento: { value: data.emAndamento.length, color: reportTheme.colors.emAndamento }
    }, total);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw modern legend with cards
    const legendY = barY + barHeight + 30;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Helper to draw legend card
    const drawLegendCard = (x: number, color: string, label: string, percent: number, count: number) => {
      // Card background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x, legendY - 12, 160, 28);
      
      // Color indicator (rounded square)
      ctx.fillStyle = color;
      ctx.fillRect(x + 8, legendY - 4, 8, 8);
      
      // Label and stats
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillText(`${Math.round(percent)}%`, x + 24, legendY);
      
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${label} (${count})`, x + 50, legendY);
    };

    drawLegendCard(barX, reportTheme.colors.instalados, 'Instalados', instaladosPercent, data.concluidas.length);
    drawLegendCard(barX + 180, reportTheme.colors.pendentes, 'Pendentes', pendentesPercent, data.pendencias.length);
    drawLegendCard(barX + 360, reportTheme.colors.emAndamento, 'Em Andamento', emAndamentoPercent, data.emAndamento.length);

    // Total in bold
    const totalX = barX + 540;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Total: ${total}`, totalX, legendY);

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    canvas.remove(); // Cleanup to prevent memory leak
    resolve(dataUrl);
    } catch (error) {
      console.error('[generateStorageBarImage] Error generating storage bar:', error);
      resolve(''); // Return empty string to continue without chart
    }
  });
}

/**
 * Generate mini storage bar for pavimento summary
 * 
 * @param pendentes - Count of pending items
 * @param emAndamento - Count of in-progress items
 * @param instalados - Count of installed items
 * @returns Promise<string> - Data URL of mini chart, or empty string if generation fails
 * 
 * Error Handling:
 * - Returns empty string if canvas context fails
 * - Handles zero totals gracefully
 * - Cleans up canvas to prevent memory leaks
 * - Never throws - allows report to continue without mini chart
 * 
 * PERFORMANCE: Added canvas cleanup to prevent memory leaks
 */
export async function generateMiniStorageBar(
  pendentes: number, 
  emAndamento: number, 
  instalados: number
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = 200 * scale;
      canvas.height = 20 * scale;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('[generateMiniStorageBar] Failed to get canvas context');
        canvas.remove(); // Cleanup
        resolve('');
        return;
      }

    ctx.scale(scale, scale);
    
    const total = pendentes + emAndamento + instalados;
    if (total === 0) {
      ctx.fillStyle = reportTheme.colors.restante;
      ctx.fillRect(0, 0, 200, 20);
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      canvas.remove(); // Cleanup to prevent memory leak
      resolve(dataUrl);
      return;
    }

    // Transparent background
    ctx.clearRect(0, 0, 200, 20);

    // Add subtle shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;

    drawStorageBar(ctx, 0, 0, 200, 16, 8, {
      instalados: { value: instalados, color: reportTheme.colors.instalados },
      pendentes: { value: pendentes, color: reportTheme.colors.pendentes },
      emAndamento: { value: emAndamento, color: reportTheme.colors.emAndamento }
    }, total);

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    canvas.remove(); // Cleanup to prevent memory leak
    resolve(dataUrl);
    } catch (error) {
      console.error('[generateMiniStorageBar] Error generating mini storage bar:', error);
      resolve(''); // Return empty string to continue without mini chart
    }
  });
}

function drawStorageBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number,
  segments: {
    instalados: { value: number, color: string },
    pendentes: { value: number, color: string },
    emAndamento: { value: number, color: string }
  },
  total: number
) {
  const segmentSpacing = 2;
  const effectiveWidth = width - (segmentSpacing * 2); // 2 gaps between 3 segments
  
  // Calculate segment widths
  const instaladosWidth = total > 0 ? (segments.instalados.value / total) * effectiveWidth : 0;
  const pendentesWidth = total > 0 ? (segments.pendentes.value / total) * effectiveWidth : 0;
  const emAndamentoWidth = total > 0 ? (segments.emAndamento.value / total) * effectiveWidth : 0;
  
  let currentX = x;
  
  // Draw background with rounded corners and subtle border
  ctx.fillStyle = reportTheme.colors.restante;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, borderRadius);
  ctx.fill();
  
  // Add subtle border to background
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Draw segments with spacing and smooth transitions
  if (instaladosWidth > 0) {
    ctx.fillStyle = segments.instalados.color;
    ctx.beginPath();
    ctx.roundRect(currentX, y, instaladosWidth, height, [borderRadius, 0, 0, borderRadius]);
    ctx.fill();
    currentX += instaladosWidth + segmentSpacing;
  }
  
  if (pendentesWidth > 0) {
    ctx.fillStyle = segments.pendentes.color;
    ctx.fillRect(currentX, y, pendentesWidth, height);
    currentX += pendentesWidth + segmentSpacing;
  }
  
  if (emAndamentoWidth > 0) {
    ctx.fillStyle = segments.emAndamento.color;
    ctx.beginPath();
    ctx.roundRect(currentX, y, emAndamentoWidth, height, [0, borderRadius, borderRadius, 0]);
    ctx.fill();
  }
}

// Generate filename
export function generateFileName(project: Project, interlocutor: 'cliente' | 'fornecedor', extension: 'pdf' | 'xlsx'): string {
  const date = new Date().toISOString().split('T')[0];
  const interlocutorUpper = interlocutor.toUpperCase();
  return `Relatorio_Instalacoes_${project.name}_${date}_${interlocutorUpper}.${extension}`;
}

/**
 * Generate PDF Report with comprehensive error handling
 * 
 * @param data - Report data including project, installations, versions
 * @returns Promise<Blob> - PDF file blob, or empty blob if critical failure occurs
 * 
 * @throws Never throws - all errors are caught and logged, returning empty blob on critical failure
 * 
 * Error Handling:
 * - Validates input data (project, installations array)
 * - Continues without logo if logo fails to load
 * - Continues without chart if storage bar generation fails
 * - Continues without photo links if photo upload fails
 * - Returns empty blob only on critical PDF generation failure
 */
export async function generatePDFReport(data: ReportData): Promise<Blob> {
  try {
    // Input validation
    if (!data) {
      console.error('[generatePDFReport] Error: data is null or undefined');
      return new Blob([], { type: 'application/pdf' });
    }

    if (!data.project) {
      console.error('[generatePDFReport] Error: data.project is missing');
      return new Blob([], { type: 'application/pdf' });
    }

    if (!Array.isArray(data.installations)) {
      console.error('[generatePDFReport] Error: data.installations is not an array');
      return new Blob([], { type: 'application/pdf' });
    }

    const sections = calculateReportSections(data);
    const pavimentoSummary = calculatePavimentoSummary(sections);
    
    // Try to generate storage bar, but continue without it if it fails
    let storageBarImage = '';
    try {
      storageBarImage = await generateStorageBarImage(sections);
    } catch (error) {
      console.error('[generatePDFReport] Error generating storage bar, continuing without chart:', error);
      storageBarImage = '';
    }
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Modern footer with decorative elements
  const addFooter = () => {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    
    // Footer decorative line
    doc.setDrawColor(reportTheme.colors.primary[0], reportTheme.colors.primary[1], reportTheme.colors.primary[2]);
    doc.setLineWidth(0.8);
    doc.line(reportTheme.spacing.margin, pageHeight - 15, pageWidth - reportTheme.spacing.margin, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(reportTheme.fonts.footer);
    doc.setTextColor(reportTheme.colors.footer);
    const footerLeft = `DEA Manager`;
    const footerCenter = `${data.project.name}`;
    const footerRight = `Página ${doc.getCurrentPageInfo().pageNumber} • ${new Date(data.generatedAt).toLocaleDateString('pt-BR')}`;
    
    doc.text(footerLeft, reportTheme.spacing.margin, pageHeight - 8);
    doc.text(footerCenter, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(footerRight, pageWidth - reportTheme.spacing.margin, pageHeight - 8, { align: 'right' });
  };

  let yPosition = reportTheme.spacing.margin;

  // ============= MODERN HEADER WITH BRAND COLORS =============
  const pageWidth = doc.internal.pageSize.width;
  
  // Header background with gradient effect (simulated with overlapping rectangles)
  doc.setFillColor(reportTheme.colors.primary[0], reportTheme.colors.primary[1], reportTheme.colors.primary[2]);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Logo section (white background card)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(reportTheme.spacing.margin, yPosition, 40, 30, 3, 3, 'F');
  
  // Add company logo - graceful fallback if fails
  try {
    const logoImg = new Image();
    logoImg.src = '/logo-dea.png';
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
    });

    const maxWidth = 35;
    const aspectRatio = logoImg.width / logoImg.height;
    const logoHeight = maxWidth / aspectRatio;
    
    doc.addImage(logoImg, 'PNG', reportTheme.spacing.margin + 2.5, yPosition + (30 - logoHeight) / 2, maxWidth, logoHeight);
  } catch (error) {
    console.error('[generatePDFReport] Error loading logo, continuing without logo:', error);
    // Draw placeholder
    doc.setFontSize(10);
    doc.setTextColor(reportTheme.colors.primary[0], reportTheme.colors.primary[1], reportTheme.colors.primary[2]);
    doc.text('DEA', reportTheme.spacing.margin + 15, yPosition + 18, { align: 'center' });
  }

  // Title section with icon
  doc.setFontSize(reportTheme.fonts.title);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('📋 Relatório de Instalações', reportTheme.spacing.margin + 65, yPosition + 15);
  doc.setFont(undefined, 'normal');
  
  // Project name in header
  doc.setFontSize(14);
  doc.text(data.project.name, reportTheme.spacing.margin + 65, yPosition + 25);
  
  yPosition += 55;

  // ============= PROJECT INFO CARDS =============
  const cardY = yPosition;
  const cardHeight = 22;
  const cardWidth = (pageWidth - (reportTheme.spacing.margin * 2) - 8) / 3; // 3 cards with spacing
  
  // Helper function to draw info card
  const drawInfoCard = (x: number, icon: string, label: string, value: string) => {
    // Card background
    doc.setFillColor(reportTheme.colors.cardBg[0], reportTheme.colors.cardBg[1], reportTheme.colors.cardBg[2]);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'F');
    
    // Card border
    doc.setDrawColor(reportTheme.colors.cardBorder[0], reportTheme.colors.cardBorder[1], reportTheme.colors.cardBorder[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'S');
    
    // Icon and label
    doc.setFontSize(reportTheme.fonts.small);
    doc.setTextColor(100, 116, 139); // Slate gray
    doc.text(`${icon} ${label}`, x + 3, cardY + 7);
    
    // Value
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // Dark slate
    doc.setFont(undefined, 'bold');
    doc.text(value, x + 3, cardY + 16);
    doc.setFont(undefined, 'normal');
  };
  
  // Draw three info cards
  drawInfoCard(reportTheme.spacing.margin, '👤', 'Cliente', data.project.client || 'N/A');
  drawInfoCard(reportTheme.spacing.margin + cardWidth + 4, '📍', 'Cidade', data.project.city || 'N/A');
  drawInfoCard(reportTheme.spacing.margin + (cardWidth + 4) * 2, '📅', 'Data', new Date(data.generatedAt).toLocaleDateString('pt-BR'));
  
  yPosition += cardHeight + 15;
  
  // Optional responsavel in smaller font
  if (data.generatedBy) {
    doc.setFontSize(reportTheme.fonts.small);
    doc.setTextColor(100, 116, 139);
    doc.text(`Responsável: ${data.generatedBy}`, reportTheme.spacing.margin, yPosition);
    yPosition += 10;
  }

  // Section divider
  doc.setDrawColor(reportTheme.colors.border[0], reportTheme.colors.border[1], reportTheme.colors.border[2]);
  doc.setLineWidth(0.3);
  doc.line(reportTheme.spacing.margin, yPosition, pageWidth - reportTheme.spacing.margin, yPosition);
  yPosition += 12;

  // ============= STATISTICS CARDS SECTION =============
  // Calculate totals
  const totalItems = sections.pendencias.length + sections.concluidas.length + 
                     sections.emRevisao.length + sections.emAndamento.length;
  const progressPercent = totalItems > 0 ? Math.round((sections.concluidas.length / totalItems) * 100) : 0;
  
  // Section title with icon
  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor(30, 41, 59);
  doc.setFont(undefined, 'bold');
  doc.text('📊 Estatísticas do Projeto', reportTheme.spacing.margin, yPosition);
  doc.setFont(undefined, 'normal');
  yPosition += 12;

  // Draw 4 metric cards
  const statCardY = yPosition;
  const statCardHeight = 20;
  const statCardWidth = (pageWidth - (reportTheme.spacing.margin * 2) - 12) / 4; // 4 cards
  
  const drawStatCard = (x: number, label: string, value: string, color: [number, number, number], bgColor: [number, number, number]) => {
    // Card background
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.roundedRect(x, statCardY, statCardWidth, statCardHeight, 2, 2, 'F');
    
    // Value (large)
    doc.setFontSize(16);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont(undefined, 'bold');
    doc.text(value, x + statCardWidth / 2, statCardY + 10, { align: 'center' });
    
    // Label (small)
    doc.setFontSize(reportTheme.fonts.small);
    doc.setTextColor(71, 85, 105);
    doc.setFont(undefined, 'normal');
    doc.text(label, x + statCardWidth / 2, statCardY + 16, { align: 'center' });
  };
  
  // Total
  drawStatCard(reportTheme.spacing.margin, 'Total', totalItems.toString(), [30, 41, 59], [241, 245, 249]);
  
  // Concluídas
  drawStatCard(reportTheme.spacing.margin + statCardWidth + 4, 'Concluídas', sections.concluidas.length.toString(), 
               [22, 101, 52], reportTheme.colors.success.bg);
  
  // Pendentes
  drawStatCard(reportTheme.spacing.margin + (statCardWidth + 4) * 2, 'Pendentes', sections.pendencias.length.toString(),
               [146, 64, 14], reportTheme.colors.warning.bg);
  
  // Em Andamento
  drawStatCard(reportTheme.spacing.margin + (statCardWidth + 4) * 3, 'Em Andamento', sections.emAndamento.length.toString(),
               [71, 85, 105], reportTheme.colors.neutral.bg);
  
  yPosition += statCardHeight + 12;

  // Progress bar
  doc.setFontSize(reportTheme.fonts.small);
  doc.setTextColor(71, 85, 105);
  doc.text(`Progresso Geral: ${progressPercent}%`, reportTheme.spacing.margin, yPosition);
  yPosition += 5;
  
  const progressBarWidth = pageWidth - (reportTheme.spacing.margin * 2);
  const progressBarHeight = 8;
  
  // Background bar
  doc.setFillColor(229, 231, 235);
  doc.roundedRect(reportTheme.spacing.margin, yPosition, progressBarWidth, progressBarHeight, 4, 4, 'F');
  
  // Progress fill
  if (progressPercent > 0) {
    doc.setFillColor(34, 197, 94); // Green
    const fillWidth = (progressPercent / 100) * progressBarWidth;
    doc.roundedRect(reportTheme.spacing.margin, yPosition, fillWidth, progressBarHeight, 4, 4, 'F');
  }
  
  yPosition += 15;

  // Add storage bar if available (more detailed chart)
  if (storageBarImage) {
    doc.setFontSize(reportTheme.fonts.sectionTitle);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text('📈 Distribuição Detalhada', reportTheme.spacing.margin, yPosition);
    doc.setFont(undefined, 'normal');
    yPosition += 10;
    
    doc.addImage(storageBarImage, 'PNG', reportTheme.spacing.margin, yPosition, 170, 25);
    yPosition += 35;
  }

  // Add pavimento summary
  if (pavimentoSummary.length > 0) {
    yPosition = await addPavimentoSummaryToPDF(doc, pavimentoSummary, yPosition);
  }

  // Add sections only if they have items - each section wrapped in try/catch
  if (sections.pendencias.length > 0) {
    try {
      yPosition = await addEnhancedSectionToPDF(doc, 'Pendências', sections.pendencias, yPosition, data.interlocutor, 'pendencias', data.project.name, data.project.id);
    } catch (error) {
      console.error('[generatePDFReport] Error adding Pendências section, skipping:', error);
    }
  }

  if (sections.concluidas.length > 0) {
    try {
      yPosition = await addEnhancedSectionToPDF(doc, 'Concluídas', sections.concluidas, yPosition, data.interlocutor, 'concluidas', data.project.name, data.project.id);
    } catch (error) {
      console.error('[generatePDFReport] Error adding Concluídas section, skipping:', error);
    }
  }

  if (sections.emRevisao.length > 0) {
    try {
      yPosition = await addEnhancedSectionToPDF(doc, 'Em Revisão', sections.emRevisao, yPosition, data.interlocutor, 'revisao', data.project.name, data.project.id);
    } catch (error) {
      console.error('[generatePDFReport] Error adding Em Revisão section, skipping:', error);
    }
  }

  if (sections.emAndamento.length > 0) {
    try {
      const sectionTitle = data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento';
      yPosition = await addEnhancedSectionToPDF(doc, sectionTitle, sections.emAndamento, yPosition, data.interlocutor, 'andamento', data.project.name, data.project.id);
    } catch (error) {
      console.error('[generatePDFReport] Error adding Em Andamento section, skipping:', error);
    }
  }

  // Add footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
  } catch (error) {
    // Critical error - log detailed context and return empty blob
    logger.error('Falha crítica ao gerar relatório PDF', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        projectId: data?.project?.id,
        projectName: data?.project?.name,
        installationsCount: data?.installations?.length,
        interlocutor: data?.interlocutor,
        operacao: 'generatePDFReport',
        timestamp: new Date().toISOString()
      }
    });
    return new Blob([], { type: 'application/pdf' });
  }
}

// Add pavimento summary with mini storage bars to PDF
async function addPavimentoSummaryToPDF(
  doc: jsPDF, 
  summary: PavimentoSummary[], 
  yPosition: number
): Promise<number> {
  const pageWidth = doc.internal.pageSize.width;
  
  // Check if new page needed
  if (yPosition > 200) {
    doc.addPage();
    yPosition = reportTheme.spacing.margin;
  }

  // Modern section title with icon
  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor(30, 41, 59);
  doc.setFont(undefined, 'bold');
  doc.text('🏢 Resumo por Pavimento', reportTheme.spacing.margin, yPosition);
  doc.setFont(undefined, 'normal');
  yPosition += 12;

  // Generate mini storage bars for each pavimento
  for (const item of summary) {
    // Check if new page needed
    if (yPosition > 250) {
      doc.addPage();
      yPosition = reportTheme.spacing.margin;
    }

    // Generate mini storage bar image
    const miniBarImage = await generateMiniStorageBar(
      item.pendentes, 
      item.emAndamento, 
      item.instalados
    );

    // Pavimento card background
    const cardWidth = pageWidth - (reportTheme.spacing.margin * 2);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(reportTheme.spacing.margin, yPosition - 6, cardWidth, 16, 2, 2, 'F');
    
    // Pavimento label (bold)
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text(item.pavimento, reportTheme.spacing.margin + 3, yPosition);
    doc.setFont(undefined, 'normal');

    // Mini storage bar
    if (miniBarImage) {
      doc.addImage(miniBarImage, 'PNG', reportTheme.spacing.margin + 45, yPosition - 4, 60, 8);
    }

    // Enhanced badges with better visibility
    let badgeX = reportTheme.spacing.margin + 115;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    
    // Pendentes badge (Amber)
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.3);
    doc.roundedRect(badgeX, yPosition - 4, 18, 9, 2, 2, 'FD');
    doc.setTextColor(146, 64, 14);
    doc.text(item.pendentes.toString(), badgeX + 9, yPosition + 1.5, { align: 'center' });
    badgeX += 23;
    
    // Em Andamento badge (Gray)
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(badgeX, yPosition - 4, 18, 9, 2, 2, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.text(item.emAndamento.toString(), badgeX + 9, yPosition + 1.5, { align: 'center' });
    badgeX += 23;
    
    // Instalados badge (Green)
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(134, 239, 172);
    doc.roundedRect(badgeX, yPosition - 4, 18, 9, 2, 2, 'FD');
    doc.setTextColor(22, 101, 52);
    doc.text(item.instalados.toString(), badgeX + 9, yPosition + 1.5, { align: 'center' });
    badgeX += 23;
    
    // Total badge (Dark)
    doc.setFillColor(226, 232, 240);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(badgeX, yPosition - 4, 18, 9, 2, 2, 'FD');
    doc.setTextColor(15, 23, 42);
    doc.text(item.total.toString(), badgeX + 9, yPosition + 1.5, { align: 'center' });
    
    doc.setFont(undefined, 'normal');
    yPosition += 18;
  }

  return yPosition + 10;
}

// Flat section rendering without subgroups
async function addEnhancedSectionToPDF(
  doc: jsPDF, 
  title: string, 
  items: Installation[], 
  yPosition: number, 
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento',
  projectName?: string,
  projectId?: string
): Promise<number> {
  if (items.length === 0) return yPosition;

  // Check if new page needed for section title
  if (yPosition > 220) {
    doc.addPage();
    yPosition = reportTheme.spacing.margin;
  }

  // Modern section title with icon and decorative line
  const sectionIcons: Record<string, string> = {
    'Pendências': '⚠️',
    'Concluídas': '✅',
    'Em Revisão': '🔄',
    'Em Andamento': '⏳',
    'Aguardando Instalação': '📦'
  };
  
  const icon = sectionIcons[title] || '📋';
  
  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor(30, 41, 59);
  doc.setFont(undefined, 'bold');
  doc.text(`${icon} ${title}`, reportTheme.spacing.margin, yPosition);
  doc.setFont(undefined, 'normal');
  
  // Count badge next to title
  doc.setFontSize(10);
  doc.setFillColor(reportTheme.colors.primary[0], reportTheme.colors.primary[1], reportTheme.colors.primary[2]);
  doc.setTextColor(255, 255, 255);
  const countText = items.length.toString();
  const countWidth = doc.getTextWidth(countText) + 6;
  doc.roundedRect(reportTheme.spacing.margin + 50, yPosition - 5, countWidth, 7, 2, 2, 'F');
  doc.text(countText, reportTheme.spacing.margin + 53, yPosition, { baseline: 'middle' });
  
  yPosition += 3;
  
  // Decorative line under title
  doc.setDrawColor(reportTheme.colors.primary[0], reportTheme.colors.primary[1], reportTheme.colors.primary[2]);
  doc.setLineWidth(0.5);
  doc.line(reportTheme.spacing.margin, yPosition, reportTheme.spacing.margin + 40, yPosition);
  doc.setTextColor(0, 0, 0);
  
  yPosition += 12;

  // For flat sections (Pendencias and Em Revisao) - single table without subgroups
  if (sectionType === 'pendencias' || sectionType === 'revisao') {
    // Sort items by Pavimento, Tipologia, Código
    const sortedItems = [...items].sort((a, b) => {
      if (a.pavimento !== b.pavimento) return a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true });
      if (a.tipologia !== b.tipologia) return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
      const codeA = parseInt(a.codigo?.toString().replace(/\D/g, '') || '0');
      const codeB = parseInt(b.codigo?.toString().replace(/\D/g, '') || '0');
      return codeA - codeB;
    });

    // Pre-upload photos and create galleries for all items to avoid async in didDrawCell
    const galleryUrlsMap = new Map<string, { url: string, count: number }>();
    if ((sectionType === 'pendencias' || sectionType === 'revisao') && projectId) {
      for (const item of sortedItems) {
        if (item.photos && item.photos.length > 0) {
          const galleryUrl = await uploadPhotosForReport(item.photos, item.id);
          if (galleryUrl) {
            galleryUrlsMap.set(item.id, { url: galleryUrl, count: item.photos.length });
          }
        }
      }
    }

    // Prepare table data (full columns including Pavimento and Tipologia)
    const { columns, rows } = await prepareFlatTableData(sortedItems, interlocutor, sectionType, projectId);

    // Generate single flat table
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: yPosition,
      margin: { left: reportTheme.spacing.margin, right: reportTheme.spacing.margin },
      styles: { 
        fontSize: 9,
        cellPadding: 4,
        lineColor: reportTheme.colors.border,
        lineWidth: 0.2,
        textColor: [30, 41, 59]
      },
      headStyles: { 
        fillColor: reportTheme.colors.header,
        textColor: reportTheme.colors.headerText,
        fontStyle: 'bold',
        fontSize: 10,
        cellPadding: 5
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 4
      },
      alternateRowStyles: { 
        fillColor: reportTheme.colors.alternateRow
      },
      columnStyles: getFlatColumnStyles(sectionType, interlocutor),
      theme: 'grid',
      didDrawCell: (data) => {
        // Add clickable photo gallery links in the "Foto" column for pendencias and revisao
        if (sectionType === 'pendencias' && data.section === 'body') {
          // Photo column index: 5 for cliente, 6 for fornecedor
          const photoColumnIndex = interlocutor === 'cliente' ? 5 : 6;
          
          if (data.column.index === photoColumnIndex) {
            const item = sortedItems[data.row.index];
            const galleryInfo = galleryUrlsMap.get(item.id);
            
            if (galleryInfo) {
              // Clear the cell text first
              doc.setFillColor(data.row.index % 2 === 0 ? 255 : 250, data.row.index % 2 === 0 ? 255 : 250, data.row.index % 2 === 0 ? 255 : 251);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
              
              // Add clickable link to gallery
              const linkX = data.cell.x + 2;
              const linkY = data.cell.y + data.cell.height / 2 + 2;
              const linkText = `Ver Fotos (${galleryInfo.count})`;
              
              // Set blue color for link
              doc.setTextColor(0, 0, 255);
              doc.setFontSize(9);
              
              // Add clickable link
              doc.textWithLink(linkText, linkX, linkY, { url: galleryInfo.url });
              
              // Reset text color
              doc.setTextColor(0, 0, 0);
            } else if (item.photos && item.photos.length > 0) {
              // If upload failed, show "Sem foto" instead of breaking
              doc.setTextColor(100, 100, 100);
              doc.setFontSize(9);
              doc.text('Sem foto', data.cell.x + 2, data.cell.y + data.cell.height / 2 + 2);
              doc.setTextColor(0, 0, 0);
            }
          }
        }
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(reportTheme.fonts.footer);
        doc.setTextColor(reportTheme.colors.footer);
        const footerText = `DEA Manager • ${projectName || 'Projeto'} • ${new Date().toLocaleDateString('pt-BR')} — pág. ${doc.getCurrentPageInfo().pageNumber}`;
        doc.text(footerText, reportTheme.spacing.margin, pageHeight - 10);
      }
    });

    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    const lastY = docWithTable.lastAutoTable?.finalY ?? yPosition;
    yPosition = lastY + 10;
  } 
  // For aggregated sections (Concluidas, Em Andamento) - grouped by Pavimento and Tipologia
  else {
    const aggregatedData = aggregateByPavimentoTipologia(items);
    
    // Sort by Pavimento, then Tipologia
    const sortedAggregated = aggregatedData.sort((a, b) => {
      if (a.pavimento !== b.pavimento) return a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true });
      return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
    });

    const columns = ['Pavimento', 'Tipologia', 'Quantidade Total'];
    const rows = sortedAggregated.map(item => [
      item.pavimento,
      item.tipologia,
      item.quantidade.toString()
    ]);

    // Generate aggregated table
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: yPosition,
      margin: { left: reportTheme.spacing.margin, right: reportTheme.spacing.margin },
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        lineColor: reportTheme.colors.border,
        lineWidth: 0.2,
        textColor: [30, 41, 59]
      },
      headStyles: { 
        fillColor: reportTheme.colors.header,
        textColor: reportTheme.colors.headerText,
        fontStyle: 'bold',
        fontSize: 10,
        cellPadding: 5
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 4
      },
      alternateRowStyles: { 
        fillColor: reportTheme.colors.alternateRow
      },
      columnStyles: getAggregatedColumnStyles(),
      theme: 'grid',
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(reportTheme.fonts.footer);
        doc.setTextColor(reportTheme.colors.footer);
        const footerText = `DEA Manager • ${projectName || 'Projeto'} • ${new Date().toLocaleDateString('pt-BR')} — pág. ${doc.getCurrentPageInfo().pageNumber}`;
        doc.text(footerText, reportTheme.spacing.margin, pageHeight - 10);
      }
    });

    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    const lastY = docWithTable.lastAutoTable?.finalY ?? yPosition;
    yPosition = lastY + 10;
  }

  return yPosition;
}

/**
 * Upload a single photo with retry logic
 * 
 * @param photo - Photo data URL or blob URL
 * @param itemId - Installation item ID
 * @param index - Photo index
 * @param timestamp - Timestamp for unique filename
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Promise<string | null> - Public URL of uploaded photo, or null if all attempts fail
 * 
 * Error Handling:
 * - Retries up to maxRetries times with exponential backoff
 * - Cleans up object URLs to prevent memory leaks
 * - Logs detailed error on final failure
 * - Returns null instead of throwing (allows other photos to continue)
 */
async function uploadSinglePhotoWithRetry(
  photo: string,
  itemId: string,
  index: number,
  timestamp: number,
  maxRetries = 3
): Promise<string | null> {
  const _lastError: Error | unknown = null;  
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Validate bucket is configured
      if (!bucket) {
        console.error('[uploadSinglePhotoWithRetry] Error: Supabase bucket not configured');
        return null;
      }

      // Convert data URL to blob
      const response = await fetch(photo);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      // Create unique filename
      const filename = `reports/temp_${itemId}_${index}_${timestamp}.jpg`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      // Cleanup object URL to prevent memory leak
      URL.revokeObjectURL(objectUrl);
      
      if (uploadError) {
        const _lastError = uploadError;
        if (attempt < maxRetries - 1) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
      return urlData?.publicUrl || null;
      
    } catch (error) {
      const _lastError = error;
      if (attempt === maxRetries - 1) {
        logger.error('Falha ao fazer upload de foto após tentativas', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            itemId,
            photoIndex: index,
            attempts: maxRetries,
            operacao: 'uploadSinglePhotoWithRetry',
            timestamp: new Date().toISOString()
          }
        });
        return null;
      }
    }
  }
  
  return null;
}

// PERFORMANCE: Helper function to process photos in chunks
async function uploadPhotosInChunks<T, R>(
  items: T[],
  processFn: (item: T, index: number) => Promise<R>,
  chunkSize = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((item, idx) => processFn(item, i + idx))
    );
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * Upload photos to Supabase Storage and create HTML gallery
 * 
 * @param photos - Array of photo data URLs
 * @param itemId - Installation item ID
 * @returns Promise<string> - Public URL of HTML gallery, or empty string if all uploads fail
 * 
 * Error Handling:
 * - Validates bucket configuration before processing
 * - Validates photos array is not empty
 * - Continues with successful photos if some uploads fail
 * - Returns empty string if no photos succeed (doesn't break report)
 * - Logs detailed context on errors
 * 
 * PERFORMANCE: Optimized with batch processing (5 concurrent uploads) and retry logic (3 attempts)
 */
async function uploadPhotosForReport(photos: string[], itemId: string): Promise<string> {
  try {
    // Input validation
    if (!bucket) {
      console.error('[uploadPhotosForReport] Error: Supabase bucket not configured');
      return '';
    }

    if (!photos || photos.length === 0) {
      console.warn('[uploadPhotosForReport] No photos provided for item:', itemId);
      return '';
    }
    
    const timestamp = Date.now();
    
    // Upload photos in batches of 5 with retry logic
    const uploadedPhotoUrls = await uploadPhotosInChunks(
      photos,
      async (photo, index) => {
        return await uploadSinglePhotoWithRetry(photo, itemId, index, timestamp);
      },
      5 // Process 5 photos concurrently
    );
    
    // Filter out failed uploads
    const successfulUrls = uploadedPhotoUrls.filter(url => url !== null) as string[];
    
    if (successfulUrls.length === 0) {
      console.error('[uploadPhotosForReport] All photo uploads failed for item:', {
        itemId,
        totalPhotos: photos.length
      });
      return '';
    }

    // Log if some photos failed
    if (successfulUrls.length < photos.length) {
      console.warn('[uploadPhotosForReport] Some photo uploads failed:', {
        itemId,
        successful: successfulUrls.length,
        total: photos.length,
        failed: photos.length - successfulUrls.length
      });
    }
    
    // Create HTML gallery page
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galeria de Fotos</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
      text-align: center;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .photo-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .photo-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .photo-card img {
      width: 100%;
      height: 250px;
      object-fit: cover;
      display: block;
    }
    .photo-card .caption {
      padding: 12px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox img {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
    }
    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 30px;
      color: white;
      font-size: 40px;
      font-weight: bold;
      cursor: pointer;
      z-index: 1001;
    }
    .lightbox-close:hover {
      color: #ccc;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Galeria de Fotos (${successfulUrls.length})</h1>
    <div class="gallery">
      ${successfulUrls.map((url, idx) => `
        <div class="photo-card" onclick="openLightbox(event, '${url}')">
          <img src="${url}" alt="Foto ${idx + 1}" loading="lazy">
          <div class="caption">Foto ${idx + 1}</div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
    <img id="lightbox-img" src="" alt="Foto ampliada">
  </div>
  
  <script>
    function openLightbox(e, url) {
      e.stopPropagation();
      document.getElementById('lightbox').classList.add('active');
      document.getElementById('lightbox-img').src = url;
    }
    
    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
    }
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>`;
    
    // Upload HTML page to Supabase Storage
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const htmlFilename = `reports/gallery_${itemId}_${timestamp}.html`;
    
    const { error: htmlUploadError } = await supabase.storage
      .from(bucket)
      .upload(htmlFilename, htmlBlob, {
        contentType: 'text/html',
        upsert: true
      });
    
    if (htmlUploadError) {
      console.error('[uploadPhotosForReport] Error uploading HTML gallery:', {
        error: htmlUploadError,
        itemId,
        photoCount: successfulUrls.length
      });
      return '';
    }
    
    // Get public URL for the HTML page
    const { data: htmlUrlData } = supabase.storage.from(bucket).getPublicUrl(htmlFilename);
    return htmlUrlData?.publicUrl || '';
    
  } catch (error) {
    logger.error('Falha crítica no processo de upload de fotos', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        itemId,
        photoCount: photos?.length || 0,
        operacao: 'uploadPhotosForReport',
        timestamp: new Date().toISOString()
      }
    });
    return '';
  }
}

/**
 * Get public URLs for photos from Supabase Storage
 * 
 * @param projectId - Project ID
 * @param installationId - Installation ID
 * @returns Promise<string[]> - Array of public URLs, or empty array if errors occur
 * 
 * Error Handling:
 * - Validates bucket configuration
 * - Continues processing remaining files if some fail
 * - Returns empty array on critical errors (doesn't break report)
 * - Logs detailed context for debugging
 */
async function _getPhotoPublicUrls(projectId: string, installationId: string): Promise<string[]> {
  try {
    // Input validation
    if (!bucket) {
      console.error('[getPhotoPublicUrls] Error: Supabase bucket not configured');
      return [];
    }

    if (!projectId) {
      console.error('[getPhotoPublicUrls] Error: projectId is missing');
      return [];
    }

    if (!installationId) {
      console.error('[getPhotoPublicUrls] Error: installationId is missing');
      return [];
    }
    
    // Get files for this installation from the database
    const files = await storage.getFilesByProject(projectId);
    const installationFiles = files.filter(f =>
      f.installationId === installationId &&
      (f.type === 'image' || (typeof f.type === 'string' && f.type.startsWith('image/'))) &&
      f.storagePath
    );
    
    // Get public URLs for each file
    const urls: string[] = [];
    for (const file of installationFiles) {
      try {
        if (file.storagePath) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(file.storagePath);
          if (data?.publicUrl) {
            urls.push(data.publicUrl);
          }
        }
      } catch (fileError) {
        // Log error but continue with other files
        console.error('[getPhotoPublicUrls] Error getting URL for file, continuing:', {
          error: fileError,
          fileId: file.id,
          storagePath: file.storagePath
        });
      }
    }
    
    return urls;
  } catch (error) {
    logger.error('Falha crítica ao obter URLs públicas de fotos', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        projectId,
        installationId,
        operacao: 'getPhotoPublicUrls',
        timestamp: new Date().toISOString()
      }
    });
    return [];
  }
}

// PERFORMANCE: Cache for item versions to avoid duplicate storage calls
type CachedVersionEntry = {
  versions: ItemVersion[];
  latestRevision: number;
};

const versionCache = new Map<string, CachedVersionEntry>();

function getLatestRevision(versions: ItemVersion[]): number {
  if (!versions.length) return 0;
  return versions.reduce((max, version) => Math.max(max, version.revisao ?? 0), 0);
}

// PERFORMANCE: Batch fetch versions for multiple items at once
async function batchFetchVersions(
  itemIds: string[],
  revisionHints?: Map<string, number>
): Promise<Map<string, ItemVersion[]>> {
  const uncachedIds = itemIds.filter(id => {
    const cached = versionCache.get(id);
    if (!cached) return true;

    const latestKnownRevision = revisionHints?.get(id);
    if (latestKnownRevision != null && latestKnownRevision > cached.latestRevision) {
      versionCache.delete(id);
      return true;
    }

    return false;
  });

  if (uncachedIds.length > 0) {
    // Fetch all uncached versions in parallel
    const versionPromises = uncachedIds.map(id => storage.getItemVersions(id));
    const versionResults = await Promise.all(versionPromises);

    // Cache the results
    uncachedIds.forEach((id, index) => {
      const versions = versionResults[index];
      versionCache.set(id, {
        versions,
        latestRevision: revisionHints?.get(id) ?? getLatestRevision(versions)
      });
    });
  }

  // Return all versions (from cache)
  const result = new Map<string, ItemVersion[]>();
  itemIds.forEach(id => {
    const cached = versionCache.get(id);
    if (cached) {
      result.set(id, cached.versions);
    }
  });

  return result;
}

// PERFORMANCE: Generic function to prepare table data with configurable columns
// Consolidates prepareFlatTableData, prepareTableData, and prepareCompactTableData
async function prepareDynamicTableData(
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento',
  options: {
    includePavimento: boolean;
    includeTipologia: boolean;
  } = { includePavimento: true, includeTipologia: true },
  _projectId?: string
): Promise<{ columns: string[], rows: unknown[][] }> {
  let columns: string[] = [];
  let rows: unknown[][] = [];

  // Build columns based on options and section type
  const baseColumns: string[] = [];
  if (options.includePavimento) baseColumns.push('Pavimento');
  if (options.includeTipologia) baseColumns.push('Tipologia');
  baseColumns.push('Código', 'Descrição');

  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      columns = [...baseColumns, 'Observação', 'Foto'];
      rows = items.map((item) => {
        const row: unknown[] = [];
        if (options.includePavimento) row.push(item.pavimento);
        if (options.includeTipologia) row.push(item.tipologia);
        row.push(
          item.codigo.toString(),
          item.descricao,
          item.observacoes || '',
          (item.photos && item.photos.length > 0) ? 'Ver foto' : ''
        );
        return row;
      });
    } else {
      columns = [...baseColumns, 'Observação', 'Comentários do Fornecedor', 'Foto'];
      rows = items.map((item) => {
        const row: unknown[] = [];
        if (options.includePavimento) row.push(item.pavimento);
        if (options.includeTipologia) row.push(item.tipologia);
        row.push(
          item.codigo.toString(),
          item.descricao,
          item.observacoes || '',
          item.comentarios_fornecedor || '',
          (item.photos && item.photos.length > 0) ? 'Ver foto' : ''
        );
        return row;
      });
    }
  } else if (sectionType === 'revisao') {
    columns = [...baseColumns, 'Versão', 'Motivo'];
    
    // PERFORMANCE: Batch fetch all versions at once instead of sequential calls
    const itemIds = items.map(item => item.id);
    const revisionHints = new Map(items.map(item => [item.id, item.revisao ?? 0]));
    const versionsMap = await batchFetchVersions(itemIds, revisionHints);
    
    rows = items.map(item => {
      const row: unknown[] = [];
      if (options.includePavimento) row.push(item.pavimento);
      if (options.includeTipologia) row.push(item.tipologia);
      
      const versions = versionsMap.get(item.id) || [];
      const latestVersion = versions[versions.length - 1];
      const motivo = latestVersion ? getMotivoPtBr(latestVersion.motivo) : '';
      
      row.push(
        item.codigo.toString(),
        item.descricao,
        item.revisao.toString(),
        motivo
      );
      return row;
    });
  } else {
    // concluidas or andamento
    columns = baseColumns;
    rows = items.map(item => {
      const row: unknown[] = [];
      if (options.includePavimento) row.push(item.pavimento);
      if (options.includeTipologia) row.push(item.tipologia);
      row.push(item.codigo.toString(), item.descricao);
      return row;
    });
  }

  return { columns, rows };
}

// Prepare flat table data for Pendencias and Em Revisao sections (includes Pavimento and Tipologia)
// PERFORMANCE: Now uses optimized prepareDynamicTableData with batch version fetching
async function prepareFlatTableData(
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'revisao',
  _projectId?: string
): Promise<{ columns: string[], rows: unknown[][] }> {
  return prepareDynamicTableData(items, interlocutor, sectionType, {
    includePavimento: true,
    includeTipologia: true
  }, _projectId);
}

// Aggregate items by Pavimento and Tipologia for summary sections
function aggregateByPavimentoTipologia(items: Installation[]): { pavimento: string, tipologia: string, quantidade: number }[] {
  const aggregationMap = new Map<string, number>();

  items.forEach(item => {
    const key = `${item.pavimento}|${item.tipologia}`;
    aggregationMap.set(key, (aggregationMap.get(key) || 0) + 1);
  });

  return Array.from(aggregationMap.entries()).map(([key, quantidade]) => {
    const [pavimento, tipologia] = key.split('|');
    return { pavimento, tipologia, quantidade };
  });
}

// Get column styles for flat tables (with Pavimento and Tipologia)
function getFlatColumnStyles(
  sectionType: 'pendencias' | 'revisao',
  interlocutor: 'cliente' | 'fornecedor'
): Record<string, { halign: 'left' | 'center' | 'right'; cellWidth?: number }> {
  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      return {
        '0': { halign: 'left', cellWidth: 20 },   // Pavimento - 12%
        '1': { halign: 'left', cellWidth: 32 },   // Tipologia - 19%
        '2': { halign: 'right', cellWidth: 14 },  // Código - 8%
        '3': { halign: 'left', cellWidth: 50 },   // Descrição - 30%
        '4': { halign: 'left', cellWidth: 35 },   // Observação - 21%
        '5': { halign: 'center', cellWidth: 14 }  // Foto - 8%
      };
    } else {
      return {
        '0': { halign: 'left', cellWidth: 18 },   // Pavimento - 11%
        '1': { halign: 'left', cellWidth: 28 },   // Tipologia - 17%
        '2': { halign: 'right', cellWidth: 12 },  // Código - 7%
        '3': { halign: 'left', cellWidth: 42 },   // Descrição - 25%
        '4': { halign: 'left', cellWidth: 28 },   // Observação - 17%
        '5': { halign: 'left', cellWidth: 28 },   // Comentários do Fornecedor - 17%
        '6': { halign: 'center', cellWidth: 12 }  // Foto - 7%
      };
    }
  } else if (sectionType === 'revisao') {
    return {
      '0': { halign: 'left', cellWidth: 22 },   // Pavimento - 13%
      '1': { halign: 'left', cellWidth: 40 },   // Tipologia - 24%
      '2': { halign: 'right', cellWidth: 14 },  // Código - 8%
      '3': { halign: 'left', cellWidth: 50 },   // Descrição - 30%
      '4': { halign: 'center', cellWidth: 14 }, // Versão - 8%
      '5': { halign: 'left', cellWidth: 28 }    // Motivo - 17%
    };
  }
  
  return {};
}

// Get column styles for aggregated tables
function getAggregatedColumnStyles(): Record<string, { halign: 'left' | 'center' | 'right'; cellWidth: number }> {
  return {
    '0': { halign: 'left', cellWidth: 68 },   // Pavimento - 40%
    '1': { halign: 'left', cellWidth: 68 },   // Tipologia - 40%
    '2': { halign: 'right', cellWidth: 34 }   // Quantidade Total - 20%
  };
}

// COMMENTED OUT - Function not currently used
// async function prepareTableData(
//   items: Installation[],
//   interlocutor: 'cliente' | 'fornecedor',
//   sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento',
//   projectId?: string
// ): Promise<{ columns: string[], rows: unknown[][] }> {
//   return prepareDynamicTableData(items, interlocutor, sectionType, {
//     includePavimento: true,
//     includeTipologia: true
//   }, projectId);
// }

// Prepare compact table data (without Pavimento and Tipologia columns)
// PERFORMANCE: Now uses optimized prepareDynamicTableData with batch version fetching
async function prepareCompactTableData(
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento',
  projectId?: string
): Promise<{ columns: string[], rows: unknown[][] }> {
  return prepareDynamicTableData(items, interlocutor, sectionType, {
    includePavimento: false,
    includeTipologia: false
  }, projectId);
}

// COMMENTED OUT - Function not currently used
// function getColumnStyles(
//   sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento',
//   interlocutor: 'cliente' | 'fornecedor'
// ): Record<number, { halign: string }> {
//   const baseStyles = {
//     0: { halign: 'left' }, // Pavimento
//     1: { halign: 'left' }, // Tipologia  
//     2: { halign: 'right' }, // Código
//     3: { halign: 'left' }  // Descrição
//   };
//   if (sectionType === 'pendencias') {
//     if (interlocutor === 'cliente') {
//       return {
//         ...baseStyles,
//         4: { halign: 'left' }, // Observação
//         5: { halign: 'center' } // Foto
//       };
//     } else {
//       return {
//         ...baseStyles,
//         4: { halign: 'left' }, // Observação
//         5: { halign: 'left' }, // Comentários do Fornecedor
//         6: { halign: 'center' } // Foto
//       };
//     }
//   } else if (sectionType === 'revisao') {
//     return {
//       ...baseStyles,
//       4: { halign: 'center' }, // Versão
//       5: { halign: 'left' }    // Motivo
//     };
//   }
//   return baseStyles;
// }

// Get compact column styles (for tables without Pavimento and Tipologia)
function _getCompactColumnStyles(columns: string[]): Record<number, { halign: string }> {
  const styles: Record<number, { halign: string }> = {};
  
  columns.forEach((col, index) => {
    switch (col) {
      case 'Código':
        styles[index] = { halign: 'right' };
        break;
      case 'Versão':
        styles[index] = { halign: 'center' };
        break;
      case 'Foto':
        styles[index] = { halign: 'center' };
        break;
      default:
        styles[index] = { halign: 'left' };
    }
  });
  
  return styles;
}

async function _addSectionToPDF(
  doc: jsPDF, 
  title: string, 
  items: Installation[], 
  yPosition: number, 
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
): Promise<number> {
  // Add new page if needed
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(14);
  doc.text(title, 20, yPosition);
  yPosition += 10;

  // Prepare table data based on section type and interlocutor
  let columns: string[] = [];
  let rows: unknown[][] = [];

  // Sort items: Pavimento (natural), Tipologia (alphabetic), Código (numeric)
  const sortedItems = [...items].sort((a, b) => {
    if (a.pavimento !== b.pavimento) return a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true });
    if (a.tipologia !== b.tipologia) return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
    return a.codigo - b.codigo;
  });

  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Foto'];
      rows = sortedItems.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.observacoes || '',
        (item.photos && item.photos.length > 0) ? 'Ver foto' : ''
      ]);
    } else {
      columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Comentários do Fornecedor', 'Foto'];
      rows = sortedItems.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.observacoes || '',
        item.comentarios_fornecedor || '',
        (item.photos && item.photos.length > 0) ? 'Ver foto' : ''
      ]);
    }
  } else if (sectionType === 'revisao') {
    columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Versão', 'Motivo'];
    
    // PERFORMANCE: Batch fetch all versions at once instead of sequential calls
    const itemIds = sortedItems.map(item => item.id);
    const revisionHints = new Map(sortedItems.map(item => [item.id, item.revisao ?? 0]));
    const versionsMap = await batchFetchVersions(itemIds, revisionHints);
    
    rows = sortedItems.map(item => {
      const versions = versionsMap.get(item.id) || [];
      const latestVersion = versions[versions.length - 1];
      const motivo = latestVersion ? getMotivoPtBr(latestVersion.motivo) : '';
      
      return [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.revisao.toString(),
        motivo
      ];
    });
  } else {
    columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição'];
    rows = sortedItems.map(item => [
      item.pavimento,
      item.tipologia,
      item.codigo.toString(),
      item.descricao
    ]);
  }

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: yPosition,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [100, 100, 100] },
  });

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const finalY = docWithTable.lastAutoTable?.finalY ?? 0;
  return finalY + 20;
}

function getMotivoPtBr(motivo: string): string {
  const motivosMap: Record<string, string> = {
    'problema-instalacao': 'Problema de instalação',
    'revisao-conteudo': 'Revisão de conteúdo',
    'desaprovado-cliente': 'Desaprovado pelo cliente',
    'update-manual': 'Atualização manual',
    'outros': 'Outros',
    created: 'Criação da instalação',
    edited: 'Edição da instalação',
    restored: 'Revisão restaurada',
  };
  return motivosMap[motivo] || motivo;
}

/**
 * Generate XLSX Report with comprehensive error handling
 * 
 * @param data - Report data including project, installations, versions
 * @returns Promise<Blob> - Excel file blob, or empty blob if critical failure occurs
 * 
 * @throws Never throws - all errors are caught and logged, returning empty blob on critical failure
 * 
 * Error Handling:
 * - Validates input data (project, installations array)
 * - Continues without failed sections (adds available sections only)
 * - Logs detailed error context for debugging
 * - Returns empty blob only on critical Excel generation failure
 */
export async function generateXLSXReport(data: ReportData): Promise<Blob> {
  try {
    // Input validation
    if (!data) {
      console.error('[generateXLSXReport] Error: data is null or undefined');
      return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    if (!data.project) {
      console.error('[generateXLSXReport] Error: data.project is missing');
      return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    if (!Array.isArray(data.installations)) {
      console.error('[generateXLSXReport] Error: data.installations is not an array');
      return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    const sections = calculateReportSections(data);
    const pavimentoSummary = calculatePavimentoSummary(sections);
    const workbook = XLSX.utils.book_new();

  // Add enhanced summary sheet
  const summaryData = [
    ['Relatório de Instalações', ''],
    ['Projeto', data.project.name],
    ['Cliente', data.project.client],
    ['Data', new Date(data.generatedAt).toLocaleDateString('pt-BR')],
    
    ['', ''],
    ['Resumo Geral', ''],
    ['Pendências', sections.pendencias.length],
    ['Concluídas', sections.concluidas.length],
    ['Em Revisão', sections.emRevisao.length],
    [data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento', sections.emAndamento.length],
    ['Total', sections.pendencias.length + sections.concluidas.length + sections.emRevisao.length + sections.emAndamento.length]
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

  // Add enhanced pavimento summary sheet
  if (pavimentoSummary.length > 0) {
    const pavimentoHeaders = [
      'Pavimento', 'Pendentes', 'Em_Andamento', 'Instalados', 'Total', 
      '%Pendentes', '%Em_Andamento', '%Instalados'
    ];
    
    const pavimentoData = pavimentoSummary.map(item => {
      const total = item.pendentes + item.emAndamento + item.instalados;
      const percentPendentes = total > 0 ? Math.round((item.pendentes / total) * 100) : 0;
      const percentEmAndamento = total > 0 ? Math.round((item.emAndamento / total) * 100) : 0;
      const percentInstalados = total > 0 ? Math.round((item.instalados / total) * 100) : 0;
      
      return [
        item.pavimento,
        item.pendentes,
        item.emAndamento,
        item.instalados,
        total,
        `${percentPendentes}%`,
        `${percentEmAndamento}%`,
        `${percentInstalados}%`
      ];
    });
    
    const pavimentoSheet = XLSX.utils.aoa_to_sheet([pavimentoHeaders, ...pavimentoData]);
    // Freeze top row
    pavimentoSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    // Auto filter
    pavimentoSheet['!autofilter'] = { ref: `A1:H${pavimentoSummary.length + 1}` };
    
    XLSX.utils.book_append_sheet(workbook, pavimentoSheet, 'Resumo_Pavimento');
  }

  // Add sections only if they have items - each section wrapped in try/catch
  if (sections.pendencias.length > 0) {
    try {
      await addFlatSectionToXLSX(workbook, 'Pendências', sections.pendencias, data.interlocutor, 'pendencias', data.project.id);
    } catch (error) {
      console.error('[generateXLSXReport] Error adding Pendências section, skipping:', error);
    }
  }

  if (sections.concluidas.length > 0) {
    try {
      addAggregatedSectionToXLSX(workbook, 'Concluídas', sections.concluidas, data.interlocutor, 'concluidas');
    } catch (error) {
      console.error('[generateXLSXReport] Error adding Concluídas section, skipping:', error);
    }
  }

  if (sections.emRevisao.length > 0) {
    try {
      await addFlatSectionToXLSX(workbook, 'Em Revisão', sections.emRevisao, data.interlocutor, 'revisao', data.project.id);
    } catch (error) {
      console.error('[generateXLSXReport] Error adding Em Revisão section, skipping:', error);
    }
  }

  if (sections.emAndamento.length > 0) {
    try {
      const sheetName = data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento';
      addAggregatedSectionToXLSX(workbook, sheetName, sections.emAndamento, data.interlocutor, 'andamento');
    } catch (error) {
      console.error('[generateXLSXReport] Error adding Em Andamento section, skipping:', error);
    }
  }

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } catch (error) {
    // Critical error - log detailed context and return empty blob
    logger.error('Falha crítica ao gerar relatório Excel', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        projectId: data?.project?.id,
        projectName: data?.project?.name,
        installationsCount: data?.installations?.length,
        interlocutor: data?.interlocutor,
        operacao: 'generateXLSXReport',
        timestamp: new Date().toISOString()
      }
    });
    return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}

async function _addSectionToXLSX(
  workbook: XLSX.WorkBook,
  sheetName: string,
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
) {
  let headers: string[] = [];
  let data: (string | number)[][] = [];

  // Sort items: Pavimento (natural), Tipologia (alphabetic), Código (numeric)
  const sortedItems = [...items].sort((a, b) => {
    if (a.pavimento !== b.pavimento) return a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true });
    if (a.tipologia !== b.tipologia) return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
    return a.codigo - b.codigo;
  });

  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Foto'];
      data = sortedItems.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo,
        item.descricao,
        item.observacoes || '',
        (item.photos && item.photos.length > 0) ? 'Arquivo de foto disponível' : ''
      ]);
    } else {
      headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Comentários do Fornecedor', 'Foto'];
      data = sortedItems.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo,
        item.descricao,
        item.observacoes || '',
        item.comentarios_fornecedor || '',
        (item.photos && item.photos.length > 0) ? 'Arquivo de foto disponível' : ''
      ]);
    }
  } else if (sectionType === 'revisao') {
    headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Versão', 'Motivo'];
    
    // PERFORMANCE: Batch fetch all versions at once instead of sequential calls
    const itemIds = sortedItems.map(item => item.id);
    const revisionHints = new Map(sortedItems.map(item => [item.id, item.revisao ?? 0]));
    const versionsMap = await batchFetchVersions(itemIds, revisionHints);
    
    data = sortedItems.map(item => {
      const versions = versionsMap.get(item.id) || [];
      const latestVersion = versions[versions.length - 1];
      const motivo = latestVersion ? getMotivoPtBr(latestVersion.motivo) : '';
      
      return [
        item.pavimento,
        item.tipologia,
        item.codigo,
        item.descricao,
        item.revisao,
        motivo
      ];
    });
  } else {
    headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição'];
    data = sortedItems.map(item => [
      item.pavimento,
      item.tipologia,
      item.codigo,
      item.descricao
    ]);
  }

  const wsData = [headers, ...data];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

// Enhanced XLSX section with hierarchical structure (Pavimento → Tipologia → Items)
async function _addEnhancedSectionToXLSX(
  workbook: XLSX.WorkBook,
  sheetName: string,
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento',
  projectId?: string
) {
  // Use compact columns (without Pavimento and Tipologia)
  const { columns: compactColumns } = await prepareCompactTableData([], interlocutor, sectionType, projectId);
  const allData: (string | number)[][] = [compactColumns]; // Headers

  // Group by pavimento
  const pavimentoGroups = new Map<string, Installation[]>();
  items.forEach(item => {
    const pavimento = item.pavimento || 'Sem Pavimento';
    if (!pavimentoGroups.has(pavimento)) {
      pavimentoGroups.set(pavimento, []);
    }
    pavimentoGroups.get(pavimento)!.push(item);
  });

  // Sort pavimentos naturally
  const sortedPavimentos = Array.from(pavimentoGroups.keys()).sort((a, b) => {
    if (a === 'Sem Pavimento') return 1;
    if (b === 'Sem Pavimento') return -1;
    return a.localeCompare(b, 'pt-BR', { numeric: true });
  });

  // Process each pavimento
  for (const pavimento of sortedPavimentos) {
    const pavimentoItems = pavimentoGroups.get(pavimento)!;

    // Add pavimento title row (merged across all columns)
    const pavimentoTitle = [`Pavimento ${pavimento} • ${pavimentoItems.length} itens`];
    while (pavimentoTitle.length < compactColumns.length) {
      pavimentoTitle.push('');
    }
    allData.push(pavimentoTitle);

    // Group by tipologia within this pavimento
    const tipologiaGroups = new Map<string, Installation[]>();
    pavimentoItems.forEach(item => {
      const tipologia = item.tipologia || 'Sem Tipologia';
      if (!tipologiaGroups.has(tipologia)) {
        tipologiaGroups.set(tipologia, []);
      }
      tipologiaGroups.get(tipologia)!.push(item);
    });

    // Sort tipologias A-Z
    const sortedTipologias = Array.from(tipologiaGroups.keys()).sort();

    // Process each tipologia
    for (const tipologia of sortedTipologias) {
      const tipologiaItems = tipologiaGroups.get(tipologia)!;

      // Add tipologia title row
      const tipologiaTitle = [`${tipologia} • ${tipologiaItems.length} itens`];
      while (tipologiaTitle.length < compactColumns.length) {
        tipologiaTitle.push('');
      }
      allData.push(tipologiaTitle);

      // Sort items by código (numeric)
      const sortedItems = tipologiaItems.sort((a, b) => {
        const codeA = parseInt(a.codigo?.toString().replace(/\D/g, '') || '0');
        const codeB = parseInt(b.codigo?.toString().replace(/\D/g, '') || '0');
        return codeA - codeB;
      });

      // Add items data (compact format)
      const { rows } = await prepareCompactTableData(sortedItems, interlocutor, sectionType, projectId);
      allData.push(...(rows as (string | number)[][]));
    }

    // Add spacing between pavimentos
    const emptyRow = new Array(compactColumns.length).fill('');
    allData.push(emptyRow);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(allData);
  // Freeze top row (header)
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  // Auto filter on header row
  worksheet['!autofilter'] = { ref: `A1:${String.fromCharCode(65 + compactColumns.length - 1)}1` };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

// Convert data URL to base64 string for Excel
function _dataUrlToBase64(dataUrl: string): string {
  if (dataUrl.startsWith('data:')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

/**
 * Create hyperlink cell for XLSX with clickable link
 * 
 * @param url - Target URL
 * @param text - Display text (default: 'Ver Foto')
 * @returns Cell object with hyperlink and styling
 */
function createHyperlinkCell(url: string, text: string = 'Ver Foto'): { content: string; styles: { textColor: number[]; fontStyle: string } } {
  return {
    content: text,
    styles: {
      textColor: [0, 0, 255],
      fontStyle: 'underline'
    }
  };
}

// Add flat section to XLSX for Pendencias and Em Revisao (single table without subgroups)
async function addFlatSectionToXLSX(
  workbook: XLSX.WorkBook,
  sheetName: string,
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'revisao',
  projectId?: string
) {
  // Sort items by Pavimento, Tipologia, Código
  const sortedItems = [...items].sort((a, b) => {
    if (a.pavimento !== b.pavimento) return a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true });
    if (a.tipologia !== b.tipologia) return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
    const codeA = parseInt(a.codigo?.toString().replace(/\D/g, '') || '0');
    const codeB = parseInt(b.codigo?.toString().replace(/\D/g, '') || '0');
    return codeA - codeB;
  });

  // Pre-upload photos and create galleries for pendencias section
  const galleryUrlsMap = new Map<string, { url: string, count: number }>();
  if (sectionType === 'pendencias' && projectId) {
    for (const item of sortedItems) {
      if (item.photos && item.photos.length > 0) {
        const galleryUrl = await uploadPhotosForReport(item.photos, item.id);
        if (galleryUrl) {
          galleryUrlsMap.set(item.id, { url: galleryUrl, count: item.photos.length });
        }
      }
    }
  }

  // Prepare flat table data (includes Pavimento and Tipologia)
  const { columns, rows } = await prepareFlatTableData(sortedItems, interlocutor, sectionType, projectId);

  // For XLSX with pendencias section, create hyperlink cells for photos
  const xlsxRows = rows;

  const wsData = [columns, ...xlsxRows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  const colWidths = columns.map((col, _idx) => {
    if (col === 'Foto') return { wch: 15 };
    if (col === 'Pavimento') return { wch: 15 };
    if (col === 'Tipologia') return { wch: 20 };
    if (col === 'Código') return { wch: 10 };
    if (col === 'Descrição') return { wch: 30 };
    if (col === 'Observação') return { wch: 25 };
    if (col === 'Comentários do Fornecedor') return { wch: 25 };
    return { wch: 12 };
  });
  worksheet['!cols'] = colWidths;
  
  // Set row heights for data rows if there are photos
  const rowHeights: Array<{ hpt: number }> = [{ hpt: 20 }]; // Header row
  
  // Add hyperlink cells for photos in pendencias section
  if (sectionType === 'pendencias') {
    const photoColIndex = columns.indexOf('Foto');
    if (photoColIndex !== -1) {
      // Add hyperlinks and styling for each row that has photos
      for (let rowIdx = 0; rowIdx < sortedItems.length; rowIdx++) {
        const item = sortedItems[rowIdx];
        const galleryInfo = galleryUrlsMap.get(item.id);
        
        // Set row height
        rowHeights.push({ hpt: 20 });
        
        const cellAddress = XLSX.utils.encode_cell({ r: rowIdx + 1, c: photoColIndex });
        
        if (galleryInfo) {
          // Create clickable hyperlink cell
          const linkText = `Ver Fotos (${galleryInfo.count})`;
          worksheet[cellAddress] = createHyperlinkCell(galleryInfo.url, linkText);
        } else if (item.photos && item.photos.length > 0) {
          // If upload failed, show "Sem foto" instead of breaking
          worksheet[cellAddress] = {
            t: 's',
            v: 'Sem foto',
            s: {
              font: { color: { rgb: '999999' } },
              alignment: { horizontal: 'center', vertical: 'center' }
            }
          };
        } else {
          // Add "Sem foto" for items without photos
          worksheet[cellAddress] = {
            t: 's',
            v: 'Sem foto',
            s: {
              font: { color: { rgb: '999999' } },
              alignment: { horizontal: 'center', vertical: 'center' }
            }
          };
        }
      }
      
      worksheet['!rows'] = rowHeights;
    }
  }
  
  // Freeze top row (header)
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  // Auto filter on header row
  worksheet['!autofilter'] = { ref: `A1:${String.fromCharCode(65 + columns.length - 1)}${sortedItems.length + 1}` };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

// Add aggregated section to XLSX for Concluidas and Em Andamento (grouped by Pavimento and Tipologia)
function addAggregatedSectionToXLSX(
  workbook: XLSX.WorkBook,
  sheetName: string,
  items: Installation[],
  _interlocutor: 'cliente' | 'fornecedor',
  _sectionType: 'concluidas' | 'andamento'
) {
  const aggregatedData = aggregateByPavimentoTipologia(items);
  
  // Sort by Pavimento, then Tipologia
  const sortedAggregated = aggregatedData.sort((a, b) => {
    if (a.pavimento !== b.pavimento) return a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true });
    return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
  });

  const headers = ['Pavimento', 'Tipologia', 'Quantidade Total'];
  const rows = sortedAggregated.map(item => [
    item.pavimento,
    item.tipologia,
    item.quantidade
  ]);

  const wsData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  
  // Freeze top row (header)
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  // Auto filter on header row
  worksheet['!autofilter'] = { ref: `A1:C${sortedAggregated.length + 1}` };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}