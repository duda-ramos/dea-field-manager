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

// Generate three doughnut charts side by side
export async function generateChartImage(data: ReportSections): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 900; // Wider for 3 charts
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve('');
      return;
    }

    // Calculate totals (excluding Em Revisão from charts)
    const total = data.pendencias.length + data.concluidas.length + data.emAndamento.length;
    if (total === 0) {
      resolve('');
      return;
    }

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chart configuration
    const chartWidth = 250;
    const chartSpacing = 50;
    const centerY = canvas.height / 2;
    const radius = 80;
    const innerRadius = 50; // For doughnut effect

    // Colors - neutral palette
    const colors = {
      pendentes: '#f97316', // Orange
      concluidas: '#22c55e', // Green  
      andamento: '#6b7280'   // Gray
    };

    // Chart 1: Pendentes
    const chart1X = chartSpacing + chartWidth / 2;
    drawDoughnutChart(ctx, chart1X, centerY, radius, innerRadius, data.pendencias.length, total, colors.pendentes, 'Pendentes');

    // Chart 2: Instalados
    const chart2X = chart1X + chartWidth + chartSpacing;
    drawDoughnutChart(ctx, chart2X, centerY, radius, innerRadius, data.concluidas.length, total, colors.concluidas, 'Instalados');

    // Chart 3: Em Andamento
    const chart3X = chart2X + chartWidth + chartSpacing;
    drawDoughnutChart(ctx, chart3X, centerY, radius, innerRadius, data.emAndamento.length, total, colors.andamento, 'Em Andamento');

    resolve(canvas.toDataURL('image/png', 1.0));
  });

  function drawDoughnutChart(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    innerRadius: number,
    value: number,
    total: number,
    color: string,
    label: string
  ) {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const angle = (value / total) * 2 * Math.PI;

    // Draw background circle (light gray)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.arc(centerX, centerY, innerRadius, 2 * Math.PI, 0, true);
    ctx.fillStyle = '#f3f4f6';
    ctx.fill();

    // Draw value slice
    if (value > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + angle);
      ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + angle, -Math.PI / 2, true);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw percentage in center
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(percentage)}%`, centerX, centerY);

    // Draw label below
    ctx.font = '14px Arial';
    ctx.fillText(label, centerX, centerY + radius + 30);
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
  const chartImage = await generateChartImage(sections);
  
  const doc = new jsPDF();
  let yPosition = 20;

  // Header
  doc.setFontSize(18);
  doc.text(`Relatório de Instalações | ${data.project.name}`, 20, yPosition);
  yPosition += 15;

  doc.setFontSize(12);
  doc.text(`Cliente: ${data.project.client}`, 20, yPosition);
  yPosition += 10;
  doc.text(`Data do Relatório: ${new Date(data.generatedAt).toLocaleDateString('pt-BR')}`, 20, yPosition);
  yPosition += 15;

  // Optional responsavel in smaller font
  if (data.generatedBy) {
    doc.setFontSize(10);
    doc.text(`Responsável: ${data.generatedBy}`, 20, yPosition);
    doc.setFontSize(12);
    yPosition += 15;
  } else {
    yPosition += 5;
  }

  // Add chart if available
  if (chartImage) {
    doc.addImage(chartImage, 'PNG', 20, yPosition, 170, 85);
    yPosition += 95;
  }

  // Add sections only if they have items
  if (sections.pendencias.length > 0) {
    yPosition = addSectionToPDF(doc, 'Pendências', sections.pendencias, yPosition, data.interlocutor, 'pendencias');
  }

  if (sections.concluidas.length > 0) {
    yPosition = addSectionToPDF(doc, 'Concluídas', sections.concluidas, yPosition, data.interlocutor, 'concluidas');
  }

  if (sections.emRevisao.length > 0) {
    yPosition = addSectionToPDF(doc, 'Em Revisão', sections.emRevisao, yPosition, data.interlocutor, 'revisao');
  }

  if (sections.emAndamento.length > 0) {
    const sectionTitle = data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento';
    yPosition = addSectionToPDF(doc, sectionTitle, sections.emAndamento, yPosition, data.interlocutor, 'andamento');
  }

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
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
  const workbook = XLSX.utils.book_new();

  // Add summary sheet
  const summaryData = [
    ['Relatório de Instalações', ''],
    ['Projeto', data.project.name],
    ['Cliente', data.project.client],
    ['Data', new Date(data.generatedAt).toLocaleDateString('pt-BR')],
    
    ['', ''],
    ['Resumo', ''],
    ['Pendências', sections.pendencias.length],
    ['Concluídas', sections.concluidas.length],
    ['Em Revisão', sections.emRevisao.length],
    [data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento', sections.emAndamento.length],
    ['Total', sections.pendencias.length + sections.concluidas.length + sections.emRevisao.length + sections.emAndamento.length]
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

  // Add sections only if they have items
  if (sections.pendencias.length > 0) {
    addSectionToXLSX(workbook, 'Pendências', sections.pendencias, data.interlocutor, 'pendencias');
  }

  if (sections.concluidas.length > 0) {
    addSectionToXLSX(workbook, 'Concluídas', sections.concluidas, data.interlocutor, 'concluidas');
  }

  if (sections.emRevisao.length > 0) {
    addSectionToXLSX(workbook, 'Em Revisão', sections.emRevisao, data.interlocutor, 'revisao');
  }

  if (sections.emAndamento.length > 0) {
    const sheetName = data.interlocutor === 'fornecedor' ? 'Aguardando Instalação' : 'Em Andamento';
    addSectionToXLSX(workbook, sheetName, sections.emAndamento, data.interlocutor, 'andamento');
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