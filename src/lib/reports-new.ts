import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Chart from 'chart.js/auto';
import { Project, Installation, ItemVersion } from '@/types';
import type { ReportConfig } from '@/components/reports/ReportCustomizationModal.types';
import { DEFAULT_REPORT_CONFIG } from '@/components/reports/ReportCustomizationModal.constants';
import { storage } from './storage';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

type WorksheetCell = string | number | XLSX.CellObject;
type WorksheetRow = WorksheetCell[];

export interface PDFGenerationOptions {
  onProgress?: (progress: number, message?: string) => void;
}

type CachedPdfPhoto = {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
};

type PdfPhotoCache = Map<string, CachedPdfPhoto[]>;

interface WorksheetImage {
  name: string;
  data: string;
  extension?: string;
  opts: {
    base64: boolean;
    origin: { r: number; c: number };
    width?: number;
    height?: number;
  };
}

const STATUS_STYLE_MAP: Record<string, { fill: string; font: string }> = {
  pendente: { fill: 'FFFDE68A', font: 'FF92400E' },
  pendencia: { fill: 'FFFDE68A', font: 'FF92400E' },
  'em andamento': { fill: 'FFDBEAFE', font: 'FF1D4ED8' },
  andamento: { fill: 'FFDBEAFE', font: 'FF1D4ED8' },
  revisao: { fill: 'FFE0E7FF', font: 'FF3730A3' },
  'em revisao': { fill: 'FFE0E7FF', font: 'FF3730A3' },
  concluido: { fill: 'FFDCFCE7', font: 'FF166534' },
  concluida: { fill: 'FFDCFCE7', font: 'FF166534' },
  instalado: { fill: 'FFDCFCE7', font: 'FF166534' },
  ativo: { fill: 'FFE0F2FE', font: 'FF1E3A8A' },
  'on hold': { fill: 'FFFEF3C7', font: 'FF92400E' },
  cancelado: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  suspenso: { fill: 'FFFEF3C7', font: 'FF92400E' },
};

const DEFAULT_STATUS_STYLE = { fill: 'FFEFF6FF', font: 'FF1F2937' };

const COLUMN_WIDTHS: Record<string, number> = {
  Pavimento: 18,
  Tipologia: 24,
  Código: 12,
  Descrição: 38,
  Status: 16,
  Observação: 30,
  'Comentários do Fornecedor': 30,
  'Atualizado em': 22,
  Foto: 16,
  Versão: 12,
  Motivo: 30,
  Link: 18,
  Miniatura: 18,
  Quantidade: 14,
  Total: 14,
  Percentual: 14,
};

const SECTION_LABELS: Record<keyof ReportConfig['sections'], string> = {
  pendencias: 'Pendências',
  concluidas: 'Concluídas',
  emRevisao: 'Em Revisão',
  emAndamento: 'Em Andamento',
};

const COLUMN_LABELS_MAP: Record<keyof ReportConfig['visibleColumns'], string> = {
  pavimento: 'Pavimento',
  tipologia: 'Tipologia',
  codigo: 'Código',
  descricao: 'Descrição',
  status: 'Status',
  observations: 'Observações',
  supplierComments: 'Comentários do Fornecedor',
  updatedAt: 'Atualizado em',
  photos: 'Fotos',
};

const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string;

function getPageHeight(doc: jsPDF): number {
  const pageSize = doc.internal.pageSize as unknown as { height?: number; getHeight?: () => number };
  if (typeof pageSize.height === 'number') {
    return pageSize.height;
  }
  if (typeof pageSize.getHeight === 'function') {
    const height = pageSize.getHeight();
    if (typeof height === 'number') {
      return height;
    }
  }
  // Fallback to standard A4 height in mm
  return 297;
}

function ensureSmartPageBreak(doc: jsPDF, currentY: number, requiredSpace = 40): number {
  const pageHeight = getPageHeight(doc);
  const margin = reportTheme.spacing.margin;
  const safeBottom = pageHeight - margin;

  if (currentY + requiredSpace > safeBottom) {
    doc.addPage();
    return margin;
  }

  return currentY;
}

function resolveReportConfig(config?: ReportConfig): ReportConfig {
  if (!config) {
    return {
      ...DEFAULT_REPORT_CONFIG,
      sections: { ...DEFAULT_REPORT_CONFIG.sections },
      includeDetails: { ...DEFAULT_REPORT_CONFIG.includeDetails },
      visibleColumns: { ...DEFAULT_REPORT_CONFIG.visibleColumns },
    };
  }

  return {
    ...DEFAULT_REPORT_CONFIG,
    ...config,
    sections: {
      ...DEFAULT_REPORT_CONFIG.sections,
      ...config.sections,
    },
    includeDetails: {
      ...DEFAULT_REPORT_CONFIG.includeDetails,
      ...config.includeDetails,
    },
    visibleColumns: {
      ...DEFAULT_REPORT_CONFIG.visibleColumns,
      ...config.visibleColumns,
    },
  };
}

function normalizeStatusKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatStatusLabel(value?: string): string {
  if (!value) return 'Sem status';
  return value
    .toString()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getStatusDisplay(
  item: Installation,
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
): { label: string; key: string } {
  if (item.status) {
    const key = normalizeStatusKey(item.status);
    return {
      label: formatStatusLabel(item.status),
      key,
    };
  }

  const fallbackMap: Record<typeof sectionType, string> = {
    pendencias: 'pendente',
    concluidas: 'concluido',
    revisao: 'em revisao',
    andamento: 'em andamento',
  };

  const fallback = fallbackMap[sectionType];
  return {
    label: formatStatusLabel(fallback),
    key: normalizeStatusKey(fallback),
  };
}

function createStatusCell(display: { label: string; key: string }): XLSX.CellObject {
  const style = STATUS_STYLE_MAP[display.key] ?? DEFAULT_STATUS_STYLE;
  return {
    t: 's',
    v: display.label,
    s: {
      fill: { fgColor: { rgb: style.fill } },
      font: { color: { rgb: style.font }, bold: true },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    },
  };
}

function formatDateTime(value?: string | number): string {
  if (!value) return '';
  try {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('pt-BR');
  } catch (_error) {
    return '';
  }
}

async function fetchThumbnailDataUrl(photoUrl: string, size = 100): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(photoUrl);
    if (!response.ok) {
      console.warn('[fetchThumbnailDataUrl] Failed to download photo for thumbnail', { photoUrl });
      return null;
    }

    const blob = await response.blob();

    return await new Promise(resolve => {
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(image, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch (error) {
          console.error('[fetchThumbnailDataUrl] Failed to render thumbnail', error);
          resolve(null);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      image.src = objectUrl;
    });
  } catch (error) {
    console.error('[fetchThumbnailDataUrl] Unexpected error generating thumbnail', error);
    return null;
  }
}

async function fetchCompressedImageDataUrl(photoUrl: string, size = 150, quality = 0.72): Promise<CachedPdfPhoto | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(photoUrl);
    if (!response.ok) {
      console.warn('[fetchCompressedImageDataUrl] Failed to download photo', { photoUrl, status: response.status });
      return null;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      const ratio = Math.min(size / image.width, size / image.height, 1);
      const drawWidth = Math.max(1, Math.round(image.width * ratio));
      const drawHeight = Math.max(1, Math.round(image.height * ratio));
      const offsetX = Math.round((size - drawWidth) / 2);
      const offsetY = Math.round((size - drawHeight) / 2);

      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      return {
        dataUrl,
        format: 'JPEG'
      };
    } catch (error) {
      console.error('[fetchCompressedImageDataUrl] Failed to process image', error);
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.error('[fetchCompressedImageDataUrl] Unexpected error', error);
    return null;
  }
}

async function buildPdfPhotoCache(
  sections: ReportSections,
  options: {
    maxPhotosPerItem: number;
    thumbnailSize?: number;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<PdfPhotoCache> {
  const cache: PdfPhotoCache = new Map();

  if (typeof window === 'undefined') {
    return cache;
  }

  const thumbnailSize = options.thumbnailSize ?? 150;
  const itemsWithPhotos = [
    ...sections.pendencias,
    ...sections.concluidas,
    ...sections.emRevisao,
    ...sections.emAndamento
  ].filter(item => Array.isArray(item.photos) && item.photos.length > 0);

  const totalPhotos = itemsWithPhotos.reduce((total, item) => {
    return total + Math.min(item.photos.length, options.maxPhotosPerItem);
  }, 0);

  if (totalPhotos === 0) {
    options.onProgress?.(0, 0);
    return cache;
  }

  let processed = 0;

  for (const item of itemsWithPhotos) {
    const compressedPhotos: CachedPdfPhoto[] = [];
    const limit = Math.min(item.photos.length, options.maxPhotosPerItem);

    for (let index = 0; index < limit; index++) {
      const photoUrl = item.photos[index];
      try {
        const compressed = await fetchCompressedImageDataUrl(photoUrl, thumbnailSize);
        if (compressed) {
          compressedPhotos.push(compressed);
        }
      } catch (error) {
        console.warn('[buildPdfPhotoCache] Failed to compress photo', { photoUrl, error });
      } finally {
        processed += 1;
        options.onProgress?.(processed, totalPhotos);
      }
    }

    if (compressedPhotos.length > 0) {
      cache.set(item.id, compressedPhotos);
    }
  }

  if (processed < totalPhotos) {
    options.onProgress?.(totalPhotos, totalPhotos);
  }

  return cache;
}

async function generateDoughnutChartImage(totals: {
  pendencias: number;
  concluidas: number;
  emRevisao: number;
  emAndamento: number;
}): Promise<string | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    canvas.remove();
    return null;
  }

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pendências', 'Concluídas', 'Em Revisão', 'Em Andamento'],
      datasets: [
        {
          data: [totals.pendencias, totals.concluidas, totals.emRevisao, totals.emAndamento],
          backgroundColor: [
            '#F59E0B',
            '#10B981',
            '#3B82F6',
            '#6B7280',
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 16,
          },
        },
      },
    },
  });

  const dataUrl = canvas.toDataURL('image/png');
  chart.destroy();
  canvas.remove();
  return dataUrl;
}

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
  customConfig?: ReportConfig;
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

export interface TipologiaSummary {
  tipologia: string;
  pendentes: number;
  instalados: number;
  emRevisao: number;
  emAndamento: number;
  total: number;
}

// Report theme for consistent styling
export const reportTheme = {
  colors: {
    pendentes: '#F59E0B',
    instalados: '#10B981', 
    emAndamento: '#6B7280',
    restante: '#E5E7EB',
    header: [55, 65, 81] as [number, number, number], // #374151
    alternateRow: [249, 250, 251] as [number, number, number], // #F9FAFB
    border: '#E5E7EB',
    divider: '#E5E7EB',
    footer: '#6B7280'
  },
  fonts: {
    title: 22,
    subtitle: 16,
    text: 10,
    footer: 8
  },
  spacing: {
    margin: 20,
    titleBottom: 10,
    subtitleTop: 12,
    subtitleBottom: 6,
    sectionSpacing: 8
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

function calculateTipologiaSummary(data: ReportSections): TipologiaSummary[] {
  const tipologiaMap = new Map<string, TipologiaSummary>();

  const allItems = [...data.pendencias, ...data.concluidas, ...data.emRevisao, ...data.emAndamento];

  allItems.forEach(item => {
    const tipologiaKey = item.tipologia || 'Sem Tipologia';
    if (!tipologiaMap.has(tipologiaKey)) {
      tipologiaMap.set(tipologiaKey, {
        tipologia: tipologiaKey,
        pendentes: 0,
        instalados: 0,
        emRevisao: 0,
        emAndamento: 0,
        total: 0,
      });
    }

    const summary = tipologiaMap.get(tipologiaKey)!;

    if (data.pendencias.includes(item)) summary.pendentes++;
    else if (data.concluidas.includes(item)) summary.instalados++;
    else if (data.emRevisao.includes(item)) summary.emRevisao++;
    else if (data.emAndamento.includes(item)) summary.emAndamento++;

    summary.total++;
  });

  return Array.from(tipologiaMap.values()).sort((a, b) =>
    a.tipologia.localeCompare(b.tipologia, 'pt-BR', { numeric: true })
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

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 120);

    // Calculate percentages
    const instaladosPercent = (data.concluidas.length / total) * 100;
    const pendentesPercent = (data.pendencias.length / total) * 100;
    const emAndamentoPercent = (data.emAndamento.length / total) * 100;

    // Storage bar configuration
    const barX = 40;
    const barY = 30;
    const barWidth = 720;
    const barHeight = 20;
    const borderRadius = 10;

    // Draw the main storage bar
    drawStorageBar(ctx, barX, barY, barWidth, barHeight, borderRadius, {
      instalados: { value: data.concluidas.length, color: reportTheme.colors.instalados },
      pendentes: { value: data.pendencias.length, color: reportTheme.colors.pendentes },
      emAndamento: { value: data.emAndamento.length, color: reportTheme.colors.emAndamento }
    }, total);

    // Draw legend text below the bar
    const legendY = barY + barHeight + 25;
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Instalados
    ctx.fillStyle = reportTheme.colors.instalados;
    ctx.fillText('●', barX, legendY);
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`Instalados ${Math.round(instaladosPercent)}% (${data.concluidas.length})`, barX + 20, legendY);

    // Pendentes
    const pendentesX = barX + 200;
    ctx.fillStyle = reportTheme.colors.pendentes;
    ctx.fillText('●', pendentesX, legendY);
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`Pendentes ${Math.round(pendentesPercent)}% (${data.pendencias.length})`, pendentesX + 20, legendY);

    // Em Andamento
    const emAndamentoX = barX + 400;
    ctx.fillStyle = reportTheme.colors.emAndamento;
    ctx.fillText('●', emAndamentoX, legendY);
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`Em Andamento ${Math.round(emAndamentoPercent)}% (${data.emAndamento.length})`, emAndamentoX + 20, legendY);

    // Total
    const totalX = barX + 600;
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px Arial';
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

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 20);

    drawStorageBar(ctx, 0, 0, 200, 14, 7, {
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
  
  // Draw background with rounded corners
  ctx.fillStyle = reportTheme.colors.restante;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, borderRadius);
  ctx.fill();
  
  // Draw segments with spacing
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
export async function generatePDFReport(data: ReportData, options: PDFGenerationOptions = {}): Promise<Blob> {
  const reportProgress = (value: number, message?: string) => {
    if (!options.onProgress) {
      return;
    }
    try {
      options.onProgress(Math.max(0, Math.min(1, value)), message);
    } catch (error) {
      console.error('[generatePDFReport] Failed to report progress', error);
    }
  };

  let includePhotosInPdf = false;
  let cachedPhotoItems = 0;

  try {
    reportProgress(0.02, 'Validando dados do relatório...');

    if (!data) {
      console.error('[generatePDFReport] Error: data is null or undefined');
      reportProgress(1, 'Dados inválidos para gerar o PDF.');
      return new Blob([], { type: 'application/pdf' });
    }

    if (!data.project) {
      console.error('[generatePDFReport] Error: data.project is missing');
      reportProgress(1, 'Projeto não encontrado para o relatório.');
      return new Blob([], { type: 'application/pdf' });
    }

    if (!Array.isArray(data.installations)) {
      console.error('[generatePDFReport] Error: data.installations is not an array');
      reportProgress(1, 'Instalações inválidas para o relatório.');
      return new Blob([], { type: 'application/pdf' });
    }

    const resolvedConfig = resolveReportConfig(data.customConfig);
    includePhotosInPdf = resolvedConfig.pdfOptions?.variant === 'complete' && resolvedConfig.pdfOptions.includePhotos;
    const resolvedMaxPhotos = Math.max(1, resolvedConfig.pdfOptions?.maxPhotosPerItem ?? DEFAULT_REPORT_CONFIG.pdfOptions.maxPhotosPerItem ?? 3);
    const maxPhotosPerItem = Math.min(resolvedMaxPhotos, 3);

    const sections = calculateReportSections(data);
    reportProgress(0.12, 'Calculando resumos do projeto...');
    const pavimentoSummary = calculatePavimentoSummary(sections);

    reportProgress(0.16, 'Gerando gráficos de status...');
    let storageBarImage = '';
    try {
      storageBarImage = await generateStorageBarImage(sections);
    } catch (error) {
      console.error('[generatePDFReport] Error generating storage bar, continuing without chart:', error);
      storageBarImage = '';
    }

    reportProgress(0.2, includePhotosInPdf ? 'Otimizando fotos para o PDF...' : 'Preparando layout do PDF...');
    let photoCache: PdfPhotoCache = new Map();
    if (includePhotosInPdf) {
      photoCache = await buildPdfPhotoCache(sections, {
        maxPhotosPerItem,
        thumbnailSize: 150,
        onProgress: (processed, total) => {
          cachedPhotoItems = Math.max(cachedPhotoItems, processed);
          if (total <= 0) {
            reportProgress(0.4, 'Nenhuma foto para processar.');
            return;
          }
          const base = 0.2;
          const span = 0.2;
          const ratio = Math.min(1, Math.max(0, processed / total));
          reportProgress(base + span * ratio, `Otimizando fotos (${processed}/${total})...`);
        }
      });
    } else {
      reportProgress(0.4, 'Layout do PDF pronto para renderização.');
    }

    reportProgress(0.45, 'Configurando cabeçalho do relatório...');

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const addFooter = () => {
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(reportTheme.fonts.footer);
      doc.setTextColor(reportTheme.colors.footer);
      const footerText = `DEA Manager • ${data.project.name} • ${new Date(data.generatedAt).toLocaleDateString('pt-BR')} — pág. ${doc.getCurrentPageInfo().pageNumber}`;
      doc.text(footerText, reportTheme.spacing.margin, pageHeight - 10);
    };

    let yPosition = reportTheme.spacing.margin;

    try {
      const logoImg = new Image();
      logoImg.src = '/logo-dea.png';
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
      });

      const maxWidth = 30;
      const aspectRatio = logoImg.width / logoImg.height || 1;
      const logoHeight = maxWidth / aspectRatio;

      doc.addImage(logoImg, 'PNG', reportTheme.spacing.margin, yPosition, maxWidth, logoHeight);
    } catch (error) {
      console.error('[generatePDFReport] Error loading logo, continuing without logo:', error);
    }

    doc.setFontSize(reportTheme.fonts.title);
    doc.setTextColor('#000000');
    doc.text(`Relatório de Instalações | ${data.project.name}`, reportTheme.spacing.margin + 35, yPosition + 10);
    yPosition += reportTheme.spacing.titleBottom + 15;

    doc.setFontSize(12);
    doc.text(`Cliente: ${data.project.client ?? 'Não informado'}`, reportTheme.spacing.margin, yPosition);
    yPosition += 7;
    doc.text(`Data do Relatório: ${new Date(data.generatedAt).toLocaleDateString('pt-BR')}`, reportTheme.spacing.margin, yPosition);
    yPosition += 10;

    if (data.generatedBy) {
      doc.setFontSize(reportTheme.fonts.footer);
      doc.setTextColor('#6B7280');
      doc.text(`Responsável: ${data.generatedBy}`, reportTheme.spacing.margin, yPosition);
      yPosition += 8;
      doc.setTextColor('#000000');
    }

    doc.setDrawColor('#E5E7EB');
    doc.setLineWidth(0.5);
    doc.line(reportTheme.spacing.margin, yPosition, 190, yPosition);
    yPosition += 10;

    doc.setFontSize(reportTheme.fonts.subtitle);
    doc.text('Gráficos de Acompanhamento', reportTheme.spacing.margin, yPosition);
    yPosition += 10;

    if (storageBarImage) {
      doc.addImage(storageBarImage, 'PNG', reportTheme.spacing.margin, yPosition, 170, 25);
      yPosition += 35;
    }

    if (pavimentoSummary.length > 0) {
      yPosition = await addPavimentoSummaryToPDF(doc, pavimentoSummary, yPosition);
    }

    reportProgress(0.6, 'Montando seções do relatório...');

    const sectionEntries: Array<{
      title: string;
      items: Installation[];
      type: 'pendencias' | 'concluidas' | 'revisao' | 'andamento';
    }> = [
      { title: 'Pendências', items: sections.pendencias, type: 'pendencias' },
      { title: 'Concluídas', items: sections.concluidas, type: 'concluidas' },
      { title: 'Em Revisão', items: sections.emRevisao, type: 'revisao' },
      {
        title: data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento',
        items: sections.emAndamento,
        type: 'andamento'
      }
    ];

    const totalRenderableSections = sectionEntries.filter(section => section.items.length > 0).length || 1;
    let renderedSections = 0;

    for (const section of sectionEntries) {
      if (section.items.length === 0) {
        continue;
      }

      try {
        yPosition = await addEnhancedSectionToPDF(
          doc,
          section.title,
          section.items,
          yPosition,
          data.interlocutor,
          section.type,
          data.project.name,
          data.project.id,
          resolvedConfig,
          {
            photoCache,
            includeInlinePhotos: includePhotosInPdf,
            maxPhotosPerItem
          }
        );
      } catch (error) {
        console.error(`[generatePDFReport] Error adding ${section.title} section, skipping:`, error);
      }

      renderedSections += 1;
      reportProgress(
        0.6 + 0.25 * (renderedSections / totalRenderableSections),
        `Seção "${section.title}" processada (${renderedSections}/${totalRenderableSections})...`
      );
    }

    reportProgress(0.88, 'Aplicando rodapés...');

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter();
    }

    const pdfBlob = doc.output('blob');
    const maxBytes = 10 * 1024 * 1024;
    if (pdfBlob.size > maxBytes) {
      reportProgress(1, 'PDF gerado (acima de 10MB). Considere usar a versão compacta.');
    } else {
      reportProgress(1, 'PDF gerado com sucesso.');
    }

    return pdfBlob;
  } catch (error) {
    reportProgress(1, 'Erro ao gerar PDF.');
    logger.error('Falha crítica ao gerar relatório PDF', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        projectId: data?.project?.id,
        projectName: data?.project?.name,
        installationsCount: data?.installations?.length,
        interlocutor: data?.interlocutor,
        includePhotos: includePhotosInPdf,
        processedPhotos: cachedPhotoItems,
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
  yPosition = ensureSmartPageBreak(doc, yPosition, 30);

  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor('#000000');
  doc.text('Resumo por Pavimento', reportTheme.spacing.margin, yPosition);
  yPosition += 15;

  // Generate mini storage bars for each pavimento
  for (const item of summary) {
    yPosition = ensureSmartPageBreak(doc, yPosition, 20);

    // Generate mini storage bar image
    const miniBarImage = await generateMiniStorageBar(
      item.pendentes,
      item.emAndamento, 
      item.instalados
    );

    // Pavimento label
    doc.setFontSize(12);
    doc.setTextColor('#374151');
    doc.text(item.pavimento, reportTheme.spacing.margin, yPosition);

    // Mini storage bar
    if (miniBarImage) {
      doc.addImage(miniBarImage, 'PNG', reportTheme.spacing.margin + 40, yPosition - 4, 60, 8);
    }

    // Badges with numbers
    let badgeX = reportTheme.spacing.margin + 110;
    doc.setFontSize(9);
    
    // Pendentes badge
    doc.setFillColor('#FEF3C7'); // Light orange background
    doc.setTextColor('#92400E'); // Dark orange text
    doc.roundedRect(badgeX, yPosition - 4, 15, 8, 2, 2, 'F');
    doc.text(item.pendentes.toString(), badgeX + 4, yPosition + 1);
    badgeX += 20;
    
    // Em Andamento badge
    doc.setFillColor('#F3F4F6'); // Light gray background
    doc.setTextColor('#374151'); // Dark gray text
    doc.roundedRect(badgeX, yPosition - 4, 15, 8, 2, 2, 'F');
    doc.text(item.emAndamento.toString(), badgeX + 4, yPosition + 1);
    badgeX += 20;
    
    // Instalados badge
    doc.setFillColor('#D1FAE5'); // Light green background
    doc.setTextColor('#065F46'); // Dark green text
    doc.roundedRect(badgeX, yPosition - 4, 15, 8, 2, 2, 'F');
    doc.text(item.instalados.toString(), badgeX + 4, yPosition + 1);
    badgeX += 20;
    
    // Total badge
    doc.setFillColor('#E5E7EB'); // Light gray background
    doc.setTextColor('#111827'); // Black text
    doc.setFont(undefined, 'bold');
    doc.roundedRect(badgeX, yPosition - 4, 15, 8, 2, 2, 'F');
    doc.text(item.total.toString(), badgeX + 4, yPosition + 1);
    doc.setFont(undefined, 'normal');

    yPosition += 15;
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
  projectId?: string,
  config?: ReportConfig,
  pdfContext?: {
    photoCache?: PdfPhotoCache;
    includeInlinePhotos?: boolean;
    maxPhotosPerItem?: number;
  }
): Promise<number> {
  if (items.length === 0) return yPosition;

  yPosition = ensureSmartPageBreak(doc, yPosition, 35);

  // Section title
  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor('#000000');
  doc.text(title, reportTheme.spacing.margin, yPosition);
  yPosition += 15;

  const inlinePhotoCache = pdfContext?.photoCache;
  const renderInlinePhotos = Boolean(pdfContext?.includeInlinePhotos && inlinePhotoCache && inlinePhotoCache.size > 0);
  const maxInlinePhotos = Math.max(
    1,
    Math.min(pdfContext?.maxPhotosPerItem ?? DEFAULT_REPORT_CONFIG.pdfOptions.maxPhotosPerItem, 3)
  );

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

    // Pre-upload photos and create galleries for all items to avoid async in didDrawCell when inline photos are disabled
    const galleryUrlsMap = new Map<string, { url: string, count: number }>();
    if (!renderInlinePhotos && (sectionType === 'pendencias' || sectionType === 'revisao') && projectId) {
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
    const { columns, rows } = await prepareFlatTableData(sortedItems, interlocutor, sectionType, config, projectId);
    const photoColumnIndices = new Set<number>();
    columns.forEach((column, index) => {
      if (column.toLowerCase().startsWith('foto')) {
        photoColumnIndices.add(index);
      }
    });
    const shouldRenderInline = renderInlinePhotos && photoColumnIndices.size > 0;

    // Generate single flat table
    const tableStartY = ensureSmartPageBreak(doc, yPosition, 60);

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: tableStartY,
      margin: { left: reportTheme.spacing.margin, right: reportTheme.spacing.margin },
      styles: { 
        fontSize: 10,
        cellPadding: 3,
        lineColor: [229, 231, 235],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [55, 65, 81], // #374151
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 3
      },
      alternateRowStyles: { 
        fillColor: [250, 250, 251] // #FAFAFB
      },
      columnStyles: getFlatColumnStyles(sectionType, interlocutor),
      theme: 'grid',
      didParseCell: data => {
        if (shouldRenderInline && data.section === 'body' && photoColumnIndices.has(data.column.index)) {
          const item = sortedItems[data.row.index];
          const cached = inlinePhotoCache?.get(item.id) ?? [];
          if (cached.length > 0) {
            data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight ?? 0, 36);
            const rowRef = data.row as unknown as { height?: number };
            rowRef.height = Math.max(rowRef.height ?? 0, 36);
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || !photoColumnIndices.has(data.column.index)) {
          return;
        }

        const item = sortedItems[data.row.index];
        if (shouldRenderInline) {
          const cached = inlinePhotoCache?.get(item.id) ?? [];
          if (cached.length > 0) {
            data.cell.text = [];
            const padding = 2;
            const availableWidth = data.cell.width - padding * 2;
            const availableHeight = data.cell.height - padding * 2;
            const photosToRender = cached.slice(0, maxInlinePhotos);
            const columnsCount = photosToRender.length || 1;
            const gap = 2;
            const baseSize = Math.min(
              availableHeight,
              (availableWidth - gap * (columnsCount - 1)) / columnsCount
            );
            const thumbSize = Math.max(12, Math.min(baseSize, 32));
            let currentX = data.cell.x + padding;
            const offsetY = data.cell.y + padding + Math.max(0, (availableHeight - thumbSize) / 2);

            photosToRender.forEach(photo => {
              const format = photo.format === 'PNG' ? 'PNG' : 'JPEG';
              try {
                doc.addImage(photo.dataUrl, format, currentX, offsetY, thumbSize, thumbSize);
              } catch (error) {
                console.warn('[addEnhancedSectionToPDF] Failed to add inline photo', error);
              }
              currentX += thumbSize + gap;
            });

            const remaining = cached.length - photosToRender.length;
            if (remaining > 0) {
              doc.setFontSize(7);
              doc.setTextColor('#6B7280');
              doc.text(`+${remaining}`, data.cell.x + data.cell.width - 2, offsetY + thumbSize, { align: 'right' });
              doc.setTextColor('#000000');
              doc.setFontSize(10);
            }
            return;
          }
        }

        if (!renderInlinePhotos && sectionType === 'pendencias') {
          const galleryInfo = galleryUrlsMap.get(item.id);
          if (galleryInfo) {
            doc.setFillColor(data.row.index % 2 === 0 ? 255 : 250, data.row.index % 2 === 0 ? 255 : 250, data.row.index % 2 === 0 ? 255 : 251);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            const linkX = data.cell.x + 2;
            const linkY = data.cell.y + data.cell.height / 2 + 2;
            const linkText = `Ver Fotos (${galleryInfo.count})`;
            doc.setTextColor(0, 0, 255);
            doc.setFontSize(9);
            doc.textWithLink(linkText, linkX, linkY, { url: galleryInfo.url });
            doc.setTextColor(0, 0, 0);
          } else if (item.photos && item.photos.length > 0) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
            doc.text('Sem foto', data.cell.x + 2, data.cell.y + data.cell.height / 2 + 2);
            doc.setTextColor(0, 0, 0);
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
    const lastY = docWithTable.lastAutoTable?.finalY ?? tableStartY;
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
    const tableStartY = ensureSmartPageBreak(doc, yPosition, 50);

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: tableStartY,
      margin: { left: reportTheme.spacing.margin, right: reportTheme.spacing.margin },
      styles: { 
        fontSize: 10,
        cellPadding: 3,
        lineColor: [229, 231, 235],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [55, 65, 81], // #374151
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 3
      },
      alternateRowStyles: { 
        fillColor: [250, 250, 251] // #FAFAFB
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
    const lastY = docWithTable.lastAutoTable?.finalY ?? tableStartY;
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
    config?: ReportConfig;
  } = { includePavimento: true, includeTipologia: true },
  _projectId?: string,
): Promise<{ columns: string[]; rows: WorksheetRow[] }> {
  const cfg = options.config ? resolveReportConfig(options.config) : DEFAULT_REPORT_CONFIG;
  const hasCustomConfig = Boolean(options.config);

  const includePavimento = options.includePavimento && (cfg.visibleColumns.pavimento ?? true);
  const includeTipologia = options.includeTipologia && (cfg.visibleColumns.tipologia ?? true);
  const includeStatus = hasCustomConfig ? (cfg.visibleColumns.status ?? true) : false;
  const includeObservations = hasCustomConfig
    ? cfg.includeDetails.observations && (cfg.visibleColumns.observations ?? false)
    : sectionType === 'pendencias';
  const includeSupplierComments = hasCustomConfig
    ? interlocutor === 'fornecedor' && cfg.includeDetails.supplierComments && (cfg.visibleColumns.supplierComments ?? false)
    : sectionType === 'pendencias' && interlocutor === 'fornecedor';
  const includeUpdatedAt = hasCustomConfig
    ? cfg.includeDetails.timestamps && (cfg.visibleColumns.updatedAt ?? false)
    : false;
  const includePhotos = hasCustomConfig
    ? cfg.includeDetails.photos && (cfg.visibleColumns.photos ?? false)
    : sectionType === 'pendencias';

  let columns: string[] = [];
  const rows: WorksheetRow[] = [];

  if (sectionType === 'pendencias') {
    columns = [];
    if (includePavimento) columns.push('Pavimento');
    if (includeTipologia) columns.push('Tipologia');
    columns.push('Código', 'Descrição');
    if (includeStatus) columns.push('Status');
    if (includeObservations) columns.push('Observação');
    if (includeSupplierComments) columns.push('Comentários do Fornecedor');
    if (includePhotos) columns.push('Foto');
    if (includeUpdatedAt) columns.push('Atualizado em');

    items.forEach(item => {
      const row: WorksheetRow = [];
      if (includePavimento) row.push(item.pavimento || '');
      if (includeTipologia) row.push(item.tipologia || '');
      row.push(item.codigo != null ? item.codigo.toString() : '', item.descricao || '');

      if (includeStatus) {
        row.push(createStatusCell(getStatusDisplay(item, sectionType)));
      }

      if (includeObservations) {
        row.push(item.observacoes || '');
      }

      if (includeSupplierComments) {
        row.push(item.comentarios_fornecedor || '');
      }

      if (includePhotos) {
        row.push(item.photos && item.photos.length > 0 ? `Ver foto (${item.photos.length})` : 'Sem foto');
      }

      if (includeUpdatedAt) {
        row.push(formatDateTime(item.updated_at ?? item.updatedAt));
      }

      rows.push(row);
    });
  } else if (sectionType === 'revisao') {
    columns = [];
    if (includePavimento) columns.push('Pavimento');
    if (includeTipologia) columns.push('Tipologia');
    columns.push('Código', 'Descrição', 'Versão', 'Motivo');
    if (includeStatus) columns.push('Status');
    if (includeUpdatedAt) columns.push('Atualizado em');

    const itemIds = items.map(item => item.id);
    const revisionHints = new Map(items.map(item => [item.id, item.revisao ?? 0]));
    const versionsMap = await batchFetchVersions(itemIds, revisionHints);

    items.forEach(item => {
      const row: WorksheetRow = [];
      if (includePavimento) row.push(item.pavimento || '');
      if (includeTipologia) row.push(item.tipologia || '');
      row.push(item.codigo != null ? item.codigo.toString() : '', item.descricao || '');

      const versions = versionsMap.get(item.id) || [];
      const latestVersion = versions[versions.length - 1];
      const motivo = latestVersion ? getMotivoPtBr(latestVersion.motivo) : '';

      row.push(item.revisao != null ? item.revisao.toString() : '', motivo);

      if (includeStatus) {
        row.push(createStatusCell(getStatusDisplay(item, sectionType)));
      }

      if (includeUpdatedAt) {
        row.push(formatDateTime(item.updated_at ?? item.updatedAt));
      }

      rows.push(row);
    });
  } else {
    columns = [];
    if (includePavimento) columns.push('Pavimento');
    if (includeTipologia) columns.push('Tipologia');
    columns.push('Código', 'Descrição');
    if (includeStatus) columns.push('Status');
    if (includeUpdatedAt) columns.push('Atualizado em');

    items.forEach(item => {
      const row: WorksheetRow = [];
      if (includePavimento) row.push(item.pavimento || '');
      if (includeTipologia) row.push(item.tipologia || '');
      row.push(item.codigo != null ? item.codigo.toString() : '', item.descricao || '');

      if (includeStatus) {
        row.push(createStatusCell(getStatusDisplay(item, sectionType)));
      }

      if (includeUpdatedAt) {
        row.push(formatDateTime(item.updated_at ?? item.updatedAt));
      }

      rows.push(row);
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
  config?: ReportConfig,
  projectId?: string,
): Promise<{ columns: string[]; rows: WorksheetRow[] }> {
  return prepareDynamicTableData(items, interlocutor, sectionType, {
    includePavimento: true,
    includeTipologia: true,
    config,
  }, projectId);
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
  config?: ReportConfig,
  projectId?: string,
): Promise<{ columns: string[]; rows: WorksheetRow[] }> {
  return prepareDynamicTableData(items, interlocutor, sectionType, {
    includePavimento: false,
    includeTipologia: false,
    config,
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
  yPosition = ensureSmartPageBreak(doc, yPosition, 30);

  doc.setFontSize(14);
  doc.text(title, reportTheme.spacing.margin, yPosition);
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

  const tableStartY = ensureSmartPageBreak(doc, yPosition, 60);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: tableStartY,
    margin: { left: reportTheme.spacing.margin, right: reportTheme.spacing.margin },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [100, 100, 100] },
  });

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const finalY = docWithTable.lastAutoTable?.finalY ?? tableStartY;
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

    const config = resolveReportConfig(data.customConfig);
    const sections = calculateReportSections(data);
    const pavimentoSummary = calculatePavimentoSummary(sections);
    const tipologiaSummary = calculateTipologiaSummary(sections);
    const workbook = XLSX.utils.book_new();

    const totals = {
      pendencias: sections.pendencias.length,
      concluidas: sections.concluidas.length,
      emRevisao: sections.emRevisao.length,
      emAndamento: sections.emAndamento.length,
      total: data.installations.length,
    };

    addResumoGeralSheet(workbook, data, totals, pavimentoSummary, tipologiaSummary, config);
    addPavimentoOverviewSheet(workbook, pavimentoSummary);
    addTipologiaOverviewSheet(workbook, tipologiaSummary);

    const hasPhotos = config.includeDetails.photos && data.installations.some(item => item.photos && item.photos.length > 0);
    if (hasPhotos) {
      await addPhotosSheet(workbook, data.installations, config);
    }

    await addAnalysisSheet(workbook, sections, totals, config);

    if (config.sections.pendencias && sections.pendencias.length > 0) {
      try {
        await addFlatSectionToXLSX(
          workbook,
          'Pendências',
          sections.pendencias,
          data.interlocutor,
          'pendencias',
          config,
          data.project.id,
        );
      } catch (error) {
        console.error('[generateXLSXReport] Error adding Pendências section, skipping:', error);
      }
    }

    if (config.sections.concluidas && sections.concluidas.length > 0) {
      try {
        addAggregatedSectionToXLSX(
          workbook,
          'Concluídas',
          sections.concluidas,
          data.interlocutor,
          'concluidas',
        );
      } catch (error) {
        console.error('[generateXLSXReport] Error adding Concluídas section, skipping:', error);
      }
    }

    if (config.sections.emRevisao && sections.emRevisao.length > 0) {
      try {
        await addFlatSectionToXLSX(
          workbook,
          'Em Revisão',
          sections.emRevisao,
          data.interlocutor,
          'revisao',
          config,
          data.project.id,
        );
      } catch (error) {
        console.error('[generateXLSXReport] Error adding Em Revisão section, skipping:', error);
      }
    }

    if (config.sections.emAndamento && sections.emAndamento.length > 0) {
      try {
        const sheetName = data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento';
        addAggregatedSectionToXLSX(
          workbook,
          sheetName,
          sections.emAndamento,
          data.interlocutor,
          'andamento',
        );
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
  const { columns: compactColumns } = await prepareCompactTableData([], interlocutor, sectionType, undefined, projectId);
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
      const { rows } = await prepareCompactTableData(sortedItems, interlocutor, sectionType, undefined, projectId);
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
function createHyperlinkCell(url: string, text: string = 'Ver Foto'): XLSX.CellObject {
  return {
    t: 's',
    v: text,
    l: { Target: url, Tooltip: text },
    s: {
      font: { color: { rgb: 'FF1D4ED8' }, underline: true },
      alignment: { horizontal: 'center', vertical: 'center' },
    },
  };
}

function addResumoGeralSheet(
  workbook: XLSX.WorkBook,
  data: ReportData,
  totals: { pendencias: number; concluidas: number; emRevisao: number; emAndamento: number; total: number },
  pavimentoSummary: PavimentoSummary[],
  tipologiaSummary: TipologiaSummary[],
  config: ReportConfig,
) {
  const percent = (value: number) => (totals.total > 0 ? `${((value / totals.total) * 100).toFixed(1)}%` : '0%');
  const rows: WorksheetRow[] = [];

  const headerCell: XLSX.CellObject = {
    t: 's',
    v: 'Resumo Geral do Projeto',
    s: {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: 'left' },
    },
  };
  rows.push([headerCell, '', '']);

  rows.push(['Projeto', data.project.name ?? '', '']);
  rows.push(['Cliente', data.project.client ?? '', '']);
  rows.push(['Destinatário', config.interlocutor === 'fornecedor' ? 'Fornecedor' : 'Cliente', '']);
  rows.push(['Gerado por', data.generatedBy || 'Sistema', '']);
  rows.push(['Gerado em', new Date(data.generatedAt).toLocaleString('pt-BR'), '']);
  rows.push(['', '', '']);

  const statsHeader: XLSX.CellObject = {
    t: 's',
    v: 'Estatísticas',
    s: {
      font: { bold: true, sz: 14 },
    },
  };
  rows.push([statsHeader, '', '']);
  rows.push([
    { t: 's', v: 'Status', s: { font: { bold: true } } },
    { t: 's', v: 'Quantidade', s: { font: { bold: true } } },
    { t: 's', v: 'Percentual', s: { font: { bold: true } } },
  ]);
  rows.push(['Pendências', totals.pendencias, percent(totals.pendencias)]);
  rows.push(['Concluídas', totals.concluidas, percent(totals.concluidas)]);
  rows.push(['Em Revisão', totals.emRevisao, percent(totals.emRevisao)]);
  rows.push([
    data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento',
    totals.emAndamento,
    percent(totals.emAndamento),
  ]);
  rows.push(['Total de Instalações', totals.total, '100%']);
  rows.push(['', '', '']);

  const selectedSections = Object.entries(config.sections)
    .filter(([, value]) => value)
    .map(([key]) => SECTION_LABELS[key as keyof ReportConfig['sections']]);

  const visibleColumns = Object.entries(config.visibleColumns)
    .filter(([key, value]) => {
      if (!value) return false;
      if (key === 'supplierComments' && config.interlocutor !== 'fornecedor') return false;
      if (key === 'observations' && !config.includeDetails.observations) return false;
      if (key === 'photos' && !config.includeDetails.photos) return false;
      if (key === 'updatedAt' && !config.includeDetails.timestamps) return false;
      return true;
    })
    .map(([key]) => COLUMN_LABELS_MAP[key as keyof ReportConfig['visibleColumns']]);

  rows.push(['Pavimentos monitorados', pavimentoSummary.length, '']);
  rows.push(['Tipologias monitoradas', tipologiaSummary.length, '']);
  rows.push([
    'Seções incluídas',
    selectedSections.length > 0 ? selectedSections.join(', ') : 'Nenhuma seção selecionada',
    '',
  ]);
  rows.push([
    'Colunas visíveis',
    visibleColumns.length > 0 ? visibleColumns.join(', ') : 'Padrão do sistema',
    '',
  ]);
  rows.push([
    'Miniaturas',
    config.includeDetails.photos && config.includeDetails.thumbnails ? 'Ativadas' : 'Desativadas',
    '',
  ]);
  rows.push(['Gráfico de status', config.includeDetails.storageChart ? 'Ativado' : 'Desativado', '']);
  rows.push(['Resumo por pavimento', config.includeDetails.pavimentoSummary ? 'Ativado' : 'Desativado', '']);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 32 }, { wch: 36 }, { wch: 20 }];
  worksheet['!rows'] = rows.map((_, index) => {
    if (index === 0) return { hpt: 30 };
    if (index === 7) return { hpt: 26 };
    return { hpt: 20 };
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumo Geral');
}

function addPavimentoOverviewSheet(workbook: XLSX.WorkBook, summary: PavimentoSummary[]) {
  if (!summary.length) {
    return;
  }

  const headers = ['Pavimento', 'Pendências', 'Concluídas', 'Em Revisão', 'Em Andamento', 'Total', '% Concluído'];
  const rows: WorksheetRow[] = [
    headers.map(header => ({ t: 's', v: header, s: { font: { bold: true } } })),
  ];

  summary.forEach(item => {
    const percentDone = item.total > 0 ? `${((item.instalados / item.total) * 100).toFixed(1)}%` : '0%';
    rows.push([
      item.pavimento,
      item.pendentes,
      item.instalados,
      item.emRevisao,
      item.emAndamento,
      item.total,
      percentDone,
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  worksheet['!autofilter'] = { ref: `A1:G${rows.length}` };
  worksheet['!cols'] = headers.map(header => ({ wch: COLUMN_WIDTHS[header] ?? 18 }));

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Por Pavimento');
}

function addTipologiaOverviewSheet(workbook: XLSX.WorkBook, summary: TipologiaSummary[]) {
  if (!summary.length) {
    return;
  }

  const headers = ['Tipologia', 'Pendências', 'Concluídas', 'Em Revisão', 'Em Andamento', 'Total', '% Concluído'];
  const rows: WorksheetRow[] = [
    headers.map(header => ({ t: 's', v: header, s: { font: { bold: true } } })),
  ];

  summary.forEach(item => {
    const percentDone = item.total > 0 ? `${((item.instalados / item.total) * 100).toFixed(1)}%` : '0%';
    rows.push([
      item.tipologia,
      item.pendentes,
      item.instalados,
      item.emRevisao,
      item.emAndamento,
      item.total,
      percentDone,
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  worksheet['!autofilter'] = { ref: `A1:G${rows.length}` };
  worksheet['!cols'] = headers.map(header => ({ wch: COLUMN_WIDTHS[header] ?? 18 }));

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Por Tipologia');
}

async function addPhotosSheet(workbook: XLSX.WorkBook, installations: Installation[], config: ReportConfig) {
  const photoEntries: Array<{ item: Installation; url: string; label: string }> = [];

  installations.forEach(item => {
    if (item.photos && item.photos.length > 0) {
      item.photos.forEach((url, index) => {
        photoEntries.push({
          item,
          url,
          label: item.photos.length > 1 ? `Foto ${index + 1}` : 'Foto',
        });
      });
    }
  });

  if (!photoEntries.length) {
    return;
  }

  const headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Link', 'Miniatura'];
  const rows: WorksheetRow[] = [
    headers.map(header => ({ t: 's', v: header, s: { font: { bold: true } } })),
  ];
  const rowHeights: Array<{ hpt: number }> = [{ hpt: 24 }];

  photoEntries.forEach(entry => {
    const row: WorksheetRow = [
      entry.item.pavimento || '—',
      entry.item.tipologia || '—',
      entry.item.codigo != null ? entry.item.codigo.toString() : '',
      entry.item.descricao || '',
      createHyperlinkCell(entry.url, entry.label),
      config.includeDetails.thumbnails ? '' : '—',
    ];
    rows.push(row);
    rowHeights.push({ hpt: config.includeDetails.thumbnails ? 86 : 22 });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = headers.map(header => ({ wch: COLUMN_WIDTHS[header] ?? 22 }));
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  worksheet['!autofilter'] = { ref: `A1:F${rows.length}` };
  worksheet['!rows'] = rowHeights;

  if (config.includeDetails.thumbnails) {
    const thumbnailResults = await Promise.all(
      photoEntries.map(async (entry, index) => ({
        index,
        dataUrl: await fetchThumbnailDataUrl(entry.url),
      })),
    );

    const images: WorksheetImage[] = [];
    thumbnailResults.forEach(result => {
      const rowIndex = result.index + 1;
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: headers.length - 1 });
      if (result.dataUrl) {
        images.push({
          name: `thumb-${result.index}.png`,
          data: _dataUrlToBase64(result.dataUrl),
          extension: 'png',
          opts: {
            base64: true,
            origin: { r: rowIndex, c: headers.length - 1 },
            width: 100,
            height: 100,
          },
        });
        worksheet[cellAddress] = { t: 's', v: '' };
      } else {
        worksheet[cellAddress] = {
          t: 's',
          v: 'Miniatura indisponível',
          s: {
            font: { color: { rgb: 'FF6B7280' }, italic: true },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          },
        };
      }
    });

    if (images.length) {
      (worksheet as unknown as { ['!images']?: WorksheetImage[] })['!images'] = images;
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fotos');
}

async function addAnalysisSheet(
  workbook: XLSX.WorkBook,
  sections: ReportSections,
  totals: { pendencias: number; concluidas: number; emRevisao: number; emAndamento: number; total: number },
  config: ReportConfig,
) {
  const rows: WorksheetRow[] = [];
  rows.push([
    {
      t: 's',
      v: 'Análise de Progresso',
      s: { font: { bold: true, sz: 16 }, alignment: { horizontal: 'left' } },
    },
    '',
    '',
  ]);

  const completionPercent = totals.total > 0 ? (totals.concluidas / totals.total) * 100 : 0;
  rows.push(['Progresso Geral', `${completionPercent.toFixed(1)}%`, '']);
  rows.push(['Pendências Abertas', totals.pendencias, '']);
  rows.push(['Itens em Revisão', totals.emRevisao, '']);
  rows.push(['Itens em Andamento', totals.emAndamento, '']);
  rows.push(['Total de Instalações', totals.total, '']);
  rows.push(['', '', '']);
  rows.push([
    { t: 's', v: 'Gráfico de Status (Barra)', s: { font: { bold: true } } },
    '',
    '',
  ]);
  rows.push(['', '', '']);
  rows.push(['', '', '']);
  rows.push(['', '', '']);
  rows.push([
    { t: 's', v: 'Distribuição de Status (Pizza)', s: { font: { bold: true } } },
    '',
    '',
  ]);
  rows.push(['', '', '']);
  rows.push(['', '', '']);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 22 }];
  worksheet['!rows'] = rows.map((_, index) => {
    if (index === 0) return { hpt: 30 };
    if (index === 8 || index === 12) return { hpt: 180 };
    return { hpt: 22 };
  });

  const images: WorksheetImage[] = [];

  if (config.includeDetails.storageChart) {
    const storageChart = await generateStorageBarImage(sections);
    if (storageChart) {
      images.push({
        name: 'status-bar.png',
        data: _dataUrlToBase64(storageChart),
        extension: 'png',
        opts: {
          base64: true,
          origin: { r: 8, c: 0 },
          width: 640,
          height: 160,
        },
      });
    }
  }

  const doughnutChart = await generateDoughnutChartImage({
    pendencias: totals.pendencias,
    concluidas: totals.concluidas,
    emRevisao: totals.emRevisao,
    emAndamento: totals.emAndamento,
  });

  if (doughnutChart) {
    images.push({
      name: 'status-doughnut.png',
      data: _dataUrlToBase64(doughnutChart),
      extension: 'png',
      opts: {
        base64: true,
        origin: { r: 12, c: 0 },
        width: 420,
        height: 260,
      },
    });
  }

  if (images.length) {
    (worksheet as unknown as { ['!images']?: WorksheetImage[] })['!images'] = images;
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Análise');
}

// Add flat section to XLSX for Pendencias and Em Revisao (single table without subgroups)
async function addFlatSectionToXLSX(
  workbook: XLSX.WorkBook,
  sheetName: string,
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'revisao',
  config: ReportConfig,
  projectId?: string,
) {
  const sortedItems = [...items].sort((a, b) => {
    if (a.pavimento !== b.pavimento) return a.pavimento.localeCompare(b.pavimento, 'pt-BR', { numeric: true });
    if (a.tipologia !== b.tipologia) return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
    const codeA = parseInt(a.codigo?.toString().replace(/\D/g, '') || '0');
    const codeB = parseInt(b.codigo?.toString().replace(/\D/g, '') || '0');
    return codeA - codeB;
  });

  const includePhotos = config.includeDetails.photos && config.visibleColumns.photos;
  const galleryUrlsMap = new Map<string, { url: string; count: number }>();
  if (sectionType === 'pendencias' && includePhotos && projectId) {
    for (const item of sortedItems) {
      if (item.photos && item.photos.length > 0) {
        const galleryUrl = await uploadPhotosForReport(item.photos, item.id);
        if (galleryUrl) {
          galleryUrlsMap.set(item.id, { url: galleryUrl, count: item.photos.length });
        }
      }
    }
  }

  const { columns, rows } = await prepareFlatTableData(sortedItems, interlocutor, sectionType, config, projectId);
  const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);

  worksheet['!cols'] = columns.map(column => ({ wch: COLUMN_WIDTHS[column] ?? 18 }));

  const rowHeights: Array<{ hpt: number }> = [{ hpt: 24 }];
  for (let i = 0; i < sortedItems.length; i += 1) {
    rowHeights.push({ hpt: 22 });
  }

  if (sectionType === 'pendencias' && includePhotos) {
    const photoColIndex = columns.indexOf('Foto');
    if (photoColIndex !== -1) {
      sortedItems.forEach((item, index) => {
        const galleryInfo = galleryUrlsMap.get(item.id);
        const cellAddress = XLSX.utils.encode_cell({ r: index + 1, c: photoColIndex });

        if (galleryInfo) {
          worksheet[cellAddress] = createHyperlinkCell(galleryInfo.url, `Ver Fotos (${galleryInfo.count})`);
        } else if (item.photos && item.photos.length > 0) {
          worksheet[cellAddress] = {
            t: 's',
            v: 'Arquivo indisponível',
            s: {
              font: { color: { rgb: 'FF6B7280' }, italic: true },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            },
          };
        } else {
          worksheet[cellAddress] = {
            t: 's',
            v: 'Sem foto',
            s: {
              font: { color: { rgb: 'FF9CA3AF' } },
              alignment: { horizontal: 'center', vertical: 'center' },
            },
          };
        }
      });
    }
  }

  worksheet['!rows'] = rowHeights;
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  worksheet['!autofilter'] = {
    ref: `A1:${XLSX.utils.encode_col(columns.length - 1)}${rows.length + 1}`,
  };

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