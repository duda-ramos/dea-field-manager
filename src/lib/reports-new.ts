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

// Generate chart as base64 image
export async function generateChartImage(data: ReportSections): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve('');
      return;
    }

    // Simple pie chart
    const total = data.pendencias.length + data.concluidas.length + data.emAndamento.length + data.emRevisao.length;
    if (total === 0) {
      resolve('');
      return;
    }

    const pendentesPercent = (data.pendencias.length / total) * 2 * Math.PI;
    const concluidasPercent = (data.concluidas.length / total) * 2 * Math.PI;
    const andamentoPercent = (data.emAndamento.length / total) * 2 * Math.PI;
    const revisaoPercent = (data.emRevisao.length / total) * 2 * Math.PI;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentAngle = 0;

    // Draw pendentes slice
    if (data.pendencias.length > 0) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + pendentesPercent);
      ctx.closePath();
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      currentAngle += pendentesPercent;
    }

    // Draw concluidas slice
    if (data.concluidas.length > 0) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + concluidasPercent);
      ctx.closePath();
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      currentAngle += concluidasPercent;
    }

    // Draw andamento slice
    if (data.emAndamento.length > 0) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + andamentoPercent);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      currentAngle += andamentoPercent;
    }

    // Draw revisao slice
    if (data.emRevisao.length > 0) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + revisaoPercent);
      ctx.closePath();
      ctx.fillStyle = '#8b5cf6';
      ctx.fill();
    }

    // Add legend
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    let legendY = 20;
    
    if (data.pendencias.length > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(20, legendY, 15, 15);
      ctx.fillStyle = '#000000';
      ctx.fillText(`Pendências: ${data.pendencias.length}`, 45, legendY + 12);
      legendY += 25;
    }
    
    if (data.concluidas.length > 0) {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(20, legendY, 15, 15);
      ctx.fillStyle = '#000000';
      ctx.fillText(`Concluídas: ${data.concluidas.length}`, 45, legendY + 12);
      legendY += 25;
    }
    
    if (data.emAndamento.length > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(20, legendY, 15, 15);
      ctx.fillStyle = '#000000';
      ctx.fillText(`Em Andamento: ${data.emAndamento.length}`, 45, legendY + 12);
      legendY += 25;
    }
    
    if (data.emRevisao.length > 0) {
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(20, legendY, 15, 15);
      ctx.fillStyle = '#000000';
      ctx.fillText(`Em Revisão: ${data.emRevisao.length}`, 45, legendY + 12);
    }

    resolve(canvas.toDataURL('image/png'));
  });
}

// Generate filename
export function generateFileName(project: Project, interlocutor: 'cliente' | 'fornecedor', extension: 'pdf' | 'xlsx'): string {
  const date = new Date().toISOString().split('T')[0];
  const interlocutorUpper = interlocutor.toUpperCase();
  return `Relatorio-${project.name}-${date}-${interlocutorUpper}.${extension}`;
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
  yPosition += 10;
  doc.text(`Interlocutor: ${data.interlocutor.charAt(0).toUpperCase() + data.interlocutor.slice(1)}`, 20, yPosition);
  yPosition += 20;

  // Add chart if available
  if (chartImage) {
    doc.addImage(chartImage, 'PNG', 20, yPosition, 100, 75);
    yPosition += 85;
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

  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação'];
      rows = items.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.observacoes || ''
      ]);
    } else {
      columns = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Comentários'];
      rows = items.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo.toString(),
        item.descricao,
        item.observacoes || '',
        item.comentarios_fornecedor || ''
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
    ['Interlocutor', data.interlocutor.charAt(0).toUpperCase() + data.interlocutor.slice(1)],
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

  if (sectionType === 'pendencias') {
    if (interlocutor === 'cliente') {
      headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação'];
      data = items.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo,
        item.descricao,
        item.observacoes || ''
      ]);
    } else {
      headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Observação', 'Comentários para Fornecedor'];
      data = items.map(item => [
        item.pavimento,
        item.tipologia,
        item.codigo,
        item.descricao,
        item.observacoes || '',
        item.comentarios_fornecedor || ''
      ]);
    }
  } else if (sectionType === 'revisao') {
    headers = ['Pavimento', 'Tipologia', 'Código', 'Descrição', 'Versão', 'Motivo'];
    data = items.map(item => {
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
    data = items.map(item => [
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