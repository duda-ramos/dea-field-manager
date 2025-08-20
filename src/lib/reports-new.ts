import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Project, Installation, ItemVersion } from '@/types';
import { storage } from './storage';

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
  const { installations, versions, interlocutor } = data;
  
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

    // Check pending conditions based on interlocutor
    const hasPendingCondition = interlocutor === 'cliente' 
      ? !!item.observacoes 
      : !!(item.observacoes || item.comentarios_fornecedor);

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

// Generate iPhone-style storage bar (100% stacked)
export async function generateStorageBarImage(data: ReportSections): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    // Higher resolution for crisp PDF export
    const scale = 2;
    canvas.width = 800 * scale;
    canvas.height = 120 * scale;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
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
      resolve(canvas.toDataURL('image/png', 1.0));
      return;
    }

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 120);

    // Calculate percentages
    const pendentesPercent = (data.pendencias.length / total) * 100;
    const emAndamentoPercent = (data.emAndamento.length / total) * 100;
    const instaladosPercent = (data.concluidas.length / total) * 100;

    // Storage bar configuration
    const barX = 40;
    const barY = 30;
    const barWidth = 720;
    const barHeight = 20;
    const borderRadius = 10;

    // Draw the main storage bar
    drawStorageBar(ctx, barX, barY, barWidth, barHeight, borderRadius, {
      pendentes: { value: data.pendencias.length, color: reportTheme.colors.pendentes },
      emAndamento: { value: data.emAndamento.length, color: reportTheme.colors.emAndamento },
      instalados: { value: data.concluidas.length, color: reportTheme.colors.instalados }
    }, total);

    // Draw legend text below the bar
    const legendY = barY + barHeight + 25;
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Pendentes
    ctx.fillStyle = reportTheme.colors.pendentes;
    ctx.fillText('●', barX, legendY);
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`Pendentes ${Math.round(pendentesPercent)}% (${data.pendencias.length})`, barX + 20, legendY);

    // Em Andamento
    const emAndamentoX = barX + 200;
    ctx.fillStyle = reportTheme.colors.emAndamento;
    ctx.fillText('●', emAndamentoX, legendY);
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`Em Andamento ${Math.round(emAndamentoPercent)}% (${data.emAndamento.length})`, emAndamentoX + 20, legendY);

    // Instalados
    const instaladosX = barX + 400;
    ctx.fillStyle = reportTheme.colors.instalados;
    ctx.fillText('●', instaladosX, legendY);
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`Instalados ${Math.round(instaladosPercent)}% (${data.concluidas.length})`, instaladosX + 20, legendY);

    // Total
    const totalX = barX + 600;
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Total: ${total}`, totalX, legendY);

    resolve(canvas.toDataURL('image/png', 1.0));
  });
}

// Generate mini storage bar for pavimento summary
export async function generateMiniStorageBar(
  pendentes: number, 
  emAndamento: number, 
  instalados: number
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = 200 * scale;
    canvas.height = 20 * scale;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve('');
      return;
    }

    ctx.scale(scale, scale);
    
    const total = pendentes + emAndamento + instalados;
    if (total === 0) {
      ctx.fillStyle = reportTheme.colors.restante;
      ctx.fillRect(0, 0, 200, 20);
      resolve(canvas.toDataURL('image/png', 1.0));
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 20);

    drawStorageBar(ctx, 0, 0, 200, 14, 7, {
      pendentes: { value: pendentes, color: reportTheme.colors.pendentes },
      emAndamento: { value: emAndamento, color: reportTheme.colors.emAndamento },
      instalados: { value: instalados, color: reportTheme.colors.instalados }
    }, total);

    resolve(canvas.toDataURL('image/png', 1.0));
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
    pendentes: { value: number, color: string },
    emAndamento: { value: number, color: string },
    instalados: { value: number, color: string }
  },
  total: number
) {
  const segmentSpacing = 2;
  const effectiveWidth = width - (segmentSpacing * 2); // 2 gaps between 3 segments
  
  // Calculate segment widths
  const pendentesWidth = total > 0 ? (segments.pendentes.value / total) * effectiveWidth : 0;
  const emAndamentoWidth = total > 0 ? (segments.emAndamento.value / total) * effectiveWidth : 0;
  const instaladosWidth = total > 0 ? (segments.instalados.value / total) * effectiveWidth : 0;
  
  let currentX = x;
  
  // Draw background with rounded corners
  ctx.fillStyle = reportTheme.colors.restante;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, borderRadius);
  ctx.fill();
  
  // Draw segments with spacing
  if (pendentesWidth > 0) {
    ctx.fillStyle = segments.pendentes.color;
    ctx.beginPath();
    ctx.roundRect(currentX, y, pendentesWidth, height, [borderRadius, 0, 0, borderRadius]);
    ctx.fill();
    currentX += pendentesWidth + segmentSpacing;
  }
  
  if (emAndamentoWidth > 0) {
    ctx.fillStyle = segments.emAndamento.color;
    ctx.fillRect(currentX, y, emAndamentoWidth, height);
    currentX += emAndamentoWidth + segmentSpacing;
  }
  
  if (instaladosWidth > 0) {
    ctx.fillStyle = segments.instalados.color;
    ctx.beginPath();
    ctx.roundRect(currentX, y, instaladosWidth, height, [0, borderRadius, borderRadius, 0]);
    ctx.fill();
  }
}

// Generate filename
export function generateFileName(project: Project, interlocutor: 'cliente' | 'fornecedor', extension: 'pdf' | 'xlsx'): string {
  const date = new Date().toISOString().split('T')[0];
  const interlocutorUpper = interlocutor.toUpperCase();
  return `Relatorio_Instalacoes_${project.name}_${date}_${interlocutorUpper}.${extension}`;
}

// Generate PDF Report
export async function generatePDFReport(data: ReportData): Promise<Blob> {
  const sections = calculateReportSections(data);
  const pavimentoSummary = calculatePavimentoSummary(sections);
  const storageBarImage = await generateStorageBarImage(sections);
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Add footer to all pages
  const addFooter = () => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(reportTheme.fonts.footer);
    doc.setTextColor(reportTheme.colors.footer);
    const footerText = `DEA Manager • ${data.project.name} • ${new Date(data.generatedAt).toLocaleDateString('pt-BR')} — pág. ${doc.getCurrentPageInfo().pageNumber}`;
    doc.text(footerText, reportTheme.spacing.margin, pageHeight - 10);
  };

  let yPosition = reportTheme.spacing.margin;

  // Enhanced Header
  doc.setFontSize(reportTheme.fonts.title);
  doc.setTextColor('#000000');
  doc.text(`Relatório de Instalações | ${data.project.name}`, reportTheme.spacing.margin, yPosition);
  yPosition += reportTheme.spacing.titleBottom;

  doc.setFontSize(12);
  doc.text(`Cliente: ${data.project.client}`, reportTheme.spacing.margin, yPosition);
  yPosition += 7;
  doc.text(`Data do Relatório: ${new Date(data.generatedAt).toLocaleDateString('pt-BR')}`, reportTheme.spacing.margin, yPosition);
  yPosition += 10;

  // Optional responsavel in smaller font
  if (data.generatedBy) {
    doc.setFontSize(reportTheme.fonts.footer);
    doc.setTextColor('#6B7280');
    doc.text(`Responsável: ${data.generatedBy}`, reportTheme.spacing.margin, yPosition);
    yPosition += 8;
    doc.setTextColor('#000000');
  }

  // Header divider
  doc.setDrawColor('#E5E7EB');
  doc.setLineWidth(0.5);
  doc.line(reportTheme.spacing.margin, yPosition, 190, yPosition);
  yPosition += 10;

  // Add Gráficos de Acompanhamento section
  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor('#000000');
  doc.text('Gráficos de Acompanhamento', reportTheme.spacing.margin, yPosition);
  yPosition += 10;

  // Add storage bar if available
  if (storageBarImage) {
    doc.addImage(storageBarImage, 'PNG', reportTheme.spacing.margin, yPosition, 170, 25);
    yPosition += 35;
  }

  // Add pavimento summary
  if (pavimentoSummary.length > 0) {
    yPosition = await addPavimentoSummaryToPDF(doc, pavimentoSummary, yPosition, data.interlocutor);
  }

  // Add sections only if they have items
  if (sections.pendencias.length > 0) {
    yPosition = addEnhancedSectionToPDF(doc, 'Pendências', sections.pendencias, yPosition, data.interlocutor, 'pendencias');
  }

  if (sections.concluidas.length > 0) {
    yPosition = addEnhancedSectionToPDF(doc, 'Concluídas', sections.concluidas, yPosition, data.interlocutor, 'concluidas');
  }

  if (sections.emRevisao.length > 0) {
    yPosition = addEnhancedSectionToPDF(doc, 'Em Revisão', sections.emRevisao, yPosition, data.interlocutor, 'revisao');
  }

  if (sections.emAndamento.length > 0) {
    const sectionTitle = data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento';
    yPosition = addEnhancedSectionToPDF(doc, sectionTitle, sections.emAndamento, yPosition, data.interlocutor, 'andamento');
  }

  // Add footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
}

// Add pavimento summary with mini storage bars to PDF
async function addPavimentoSummaryToPDF(
  doc: jsPDF, 
  summary: PavimentoSummary[], 
  yPosition: number, 
  interlocutor: 'cliente' | 'fornecedor'
): Promise<number> {
  // Check if new page needed
  if (yPosition > 200) {
    doc.addPage();
    yPosition = reportTheme.spacing.margin;
  }

  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor('#000000');
  doc.text('Resumo por Pavimento', reportTheme.spacing.margin, yPosition);
  yPosition += 15;

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

// Enhanced section rendering with pavimento sub-groups
function addEnhancedSectionToPDF(
  doc: jsPDF, 
  title: string, 
  items: Installation[], 
  yPosition: number, 
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
): number {
  // Check if new page needed
  if (yPosition > 220) {
    doc.addPage();
    yPosition = reportTheme.spacing.margin;
  }

  // Section title
  doc.setFontSize(reportTheme.fonts.subtitle);
  doc.setTextColor('#000000');
  doc.text(title, reportTheme.spacing.margin, yPosition);
  yPosition += reportTheme.spacing.subtitleBottom;

  // Group items by pavimento
  const pavimentoGroups = new Map<string, Installation[]>();
  items.forEach(item => {
    if (!pavimentoGroups.has(item.pavimento)) {
      pavimentoGroups.set(item.pavimento, []);
    }
    pavimentoGroups.get(item.pavimento)!.push(item);
  });

  // Sort pavimentos naturally
  const sortedPavimentos = Array.from(pavimentoGroups.keys()).sort((a, b) => 
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );

  // Process each pavimento group
  for (const pavimento of sortedPavimentos) {
    const pavimentoItems = pavimentoGroups.get(pavimento)!;
    
    // Sort items within pavimento: Tipologia → Código
    const sortedItems = pavimentoItems.sort((a, b) => {
      if (a.tipologia !== b.tipologia) return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
      return a.codigo - b.codigo;
    });

    // Check if new page needed for pavimento group
    if (yPosition > 230) {
      doc.addPage();
      yPosition = reportTheme.spacing.margin;
    }

    // Pavimento subtitle with chip style
    doc.setFontSize(12);
    doc.setTextColor('#374151');
    doc.text(`${pavimento} — ${sortedItems.length} itens`, reportTheme.spacing.margin, yPosition);
    yPosition += 8;

    // Thin divider line
    doc.setDrawColor('#E5E7EB');
    doc.setLineWidth(0.3);
    doc.line(reportTheme.spacing.margin, yPosition, 190, yPosition);
    yPosition += 5;

    // Prepare table data
    const { columns, rows } = prepareTableData(sortedItems, interlocutor, sectionType);

    // Define column widths based on section type
    const columnStyles = getColumnStyles(sectionType, interlocutor);

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: yPosition,
      styles: { 
        fontSize: reportTheme.fonts.text,
        cellPadding: 3
      },
      headStyles: { 
        fillColor: reportTheme.colors.header,
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: reportTheme.colors.alternateRow },
      columnStyles,
      margin: { left: reportTheme.spacing.margin }
    });

    yPosition = (doc as any).lastAutoTable.finalY + reportTheme.spacing.sectionSpacing;
  }

  return yPosition;
}

// Prepare table data based on section type and interlocutor
function prepareTableData(
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
): { columns: string[], rows: any[][] } {
  let columns: string[] = [];
  let rows: any[][] = [];

  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Foto'];
      rows = items.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.observacoes || '',
        item.photos.length > 0 ? 'Ver foto' : ''
      ]);
    } else {
      columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Comentários', 'Foto'];
      rows = items.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.observacoes || '',
        item.comentarios_fornecedor || '',
        item.photos.length > 0 ? 'Ver foto' : ''
      ]);
    }
  } else if (sectionType === 'revisao') {
    columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Versão', 'Motivo'];
    rows = items.map(item => {
      const versions = storage.getInstallationVersions(item.id);
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
    rows = items.map(item => [
      item.pavimento,
      item.tipologia,
      item.codigo.toString(),
      item.descricao
    ]);
  }

  return { columns, rows };
}

// Get column styles based on section type
function getColumnStyles(
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento',
  interlocutor: 'cliente' | 'fornecedor'
): any {
  const baseStyles = {
    0: { halign: 'left' }, // Pavimento
    1: { halign: 'left' }, // Tipologia  
    2: { halign: 'right' }, // Código
    3: { halign: 'left' }  // Descrição
  };

  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      return {
        ...baseStyles,
        4: { halign: 'left' }, // Observação
        5: { halign: 'center' } // Foto
      };
    } else {
      return {
        ...baseStyles,
        4: { halign: 'left' }, // Observação
        5: { halign: 'left' }, // Comentários
        6: { halign: 'center' } // Foto
      };
    }
  } else if (sectionType === 'revisao') {
    return {
      ...baseStyles,
      4: { halign: 'center' }, // Versão
      5: { halign: 'left' }    // Motivo
    };
  }

  return baseStyles;
}

function addSectionToPDF(
  doc: jsPDF, 
  title: string, 
  items: Installation[], 
  yPosition: number, 
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
): number {
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
  let rows: any[][] = [];

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
        item.photos.length > 0 ? 'Ver foto' : ''
      ]);
    } else {
      columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Comentários', 'Foto'];
      rows = sortedItems.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.observacoes || '',
        item.comentarios_fornecedor || '',
        item.photos.length > 0 ? 'Ver foto' : ''
      ]);
    }
  } else if (sectionType === 'revisao') {
    columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Versão', 'Motivo'];
    rows = sortedItems.map(item => {
      const versions = storage.getInstallationVersions(item.id);
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

  return (doc as any).lastAutoTable.finalY + 20;
}

function getMotivoPtBr(motivo: string): string {
  const motivosMap: Record<string, string> = {
    'problema-instalacao': 'Problema de instalação',
    'revisao-conteudo': 'Revisão de conteúdo',
    'desaprovado-cliente': 'Desaprovado pelo cliente',
    'update-manual': 'Atualização manual',
    'outros': 'Outros'
  };
  return motivosMap[motivo] || motivo;
}

// Generate XLSX Report
export function generateXLSXReport(data: ReportData): Blob {
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

  // Add sections only if they have items with enhanced formatting
  if (sections.pendencias.length > 0) {
    addEnhancedSectionToXLSX(workbook, 'Pendências', sections.pendencias, data.interlocutor, 'pendencias');
  }

  if (sections.concluidas.length > 0) {
    addEnhancedSectionToXLSX(workbook, 'Concluídas', sections.concluidas, data.interlocutor, 'concluidas');
  }

  if (sections.emRevisao.length > 0) {
    addEnhancedSectionToXLSX(workbook, 'Em Revisão', sections.emRevisao, data.interlocutor, 'revisao');
  }

  if (sections.emAndamento.length > 0) {
    const sheetName = data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento';
    addEnhancedSectionToXLSX(workbook, sheetName, sections.emAndamento, data.interlocutor, 'andamento');
  }

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function addSectionToXLSX(
  workbook: XLSX.WorkBook,
  sheetName: string,
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
) {
  let headers: string[] = [];
  let data: any[][] = [];

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
        item.photos.length > 0 ? 'Arquivo de foto disponível' : ''
      ]);
    } else {
      headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Comentários', 'Foto'];
      data = sortedItems.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo,
        item.descricao,
        item.observacoes || '',
        item.comentarios_fornecedor || '',
        item.photos.length > 0 ? 'Arquivo de foto disponível' : ''
      ]);
    }
  } else if (sectionType === 'revisao') {
    headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Versão', 'Motivo'];
    data = sortedItems.map(item => {
      const versions = storage.getInstallationVersions(item.id);
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

// Enhanced XLSX section with pavimento sub-groups
function addEnhancedSectionToXLSX(
  workbook: XLSX.WorkBook,
  sheetName: string,
  items: Installation[],
  interlocutor: 'cliente' | 'fornecedor',
  sectionType: 'pendencias' | 'concluidas' | 'revisao' | 'andamento'
) {
  // Group by pavimento and prepare data with sub-headers
  const pavimentoGroups = new Map<string, Installation[]>();
  items.forEach(item => {
    if (!pavimentoGroups.has(item.pavimento)) {
      pavimentoGroups.set(item.pavimento, []);
    }
    pavimentoGroups.get(item.pavimento)!.push(item);
  });

  const sortedPavimentos = Array.from(pavimentoGroups.keys()).sort((a, b) => 
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );

  const { columns } = prepareTableData([], interlocutor, sectionType);
  const allData: any[][] = [columns]; // Headers

  // Add data with pavimento separators
  for (const pavimento of sortedPavimentos) {
    const pavimentoItems = pavimentoGroups.get(pavimento)!;
    const sortedItems = pavimentoItems.sort((a, b) => {
      if (a.tipologia !== b.tipologia) return a.tipologia.localeCompare(b.tipologia, 'pt-BR');
      return a.codigo - b.codigo;
    });

    // Add pavimento separator row
    allData.push([`${pavimento} — ${sortedItems.length} itens`, '', '', '', '', '']);
    
    // Add items data
    const { rows } = prepareTableData(sortedItems, interlocutor, sectionType);
    allData.push(...rows);
    
    // Add empty row between pavimentos
    allData.push(['', '', '', '', '', '']);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(allData);
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  worksheet['!autofilter'] = { ref: `A1:${String.fromCharCode(65 + columns.length - 1)}1` };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}