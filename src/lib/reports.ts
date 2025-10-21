import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Project, Installation } from '@/types';

export interface ReportData {
  project: Project;
  installations: Installation[];
  generatedBy: string;
  generatedAt: string;
}

export async function generatePDFReport(data: ReportData): Promise<void> {
  const { project, installations, generatedBy, generatedAt } = data;
  
  const doc = new jsPDF();
  
  // Add company logo
  try {
    const logoImg = new Image();
    logoImg.src = '/logo-dea.png';
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
    });
    
    // Calculate dimensions maintaining aspect ratio based on max width
    const maxWidth = 40;
    const aspectRatio = logoImg.width / logoImg.height;
    
    const logoWidth = maxWidth;
    const logoHeight = maxWidth / aspectRatio;
    
    doc.addImage(logoImg, 'PNG', 20, 10, logoWidth, logoHeight);
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
  }
  
  // Header
  doc.setFontSize(20);
  doc.text('Relatório de Instalações - DEA Manager', 55, 20);
  
  doc.setFontSize(12);
  doc.text(`Projeto: ${project.name}`, 20, 35);
  doc.text(`Cliente: ${project.client}`, 20, 42);
  doc.text(`Cidade: ${project.city}`, 20, 49);
  doc.text(`Data do Relatório: ${new Date(generatedAt).toLocaleDateString('pt-BR')}`, 20, 56);
  doc.text(`Responsável: ${generatedBy}`, 20, 63);
  
  // Separar instalações por categoria
  const pendencias = installations.filter(i => i.observacoes && i.observacoes.trim() !== '');
  const proximosPassos = installations.filter(i => !i.installed && (!i.observacoes || i.observacoes.trim() === ''));
  const instaladas = installations.filter(i => i.installed && (!i.observacoes || i.observacoes.trim() === ''));
  
  let yPosition = 80;
  
  // Pendências
  if (pendencias.length > 0) {
    doc.setFontSize(16);
    doc.text('PENDÊNCIAS', 20, yPosition);
    yPosition += 10;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Código', 'Descrição', 'Pavimento', 'Status', 'Observações', 'Fotos']],
      body: pendencias.map(i => {
        const photoLinks = i.photos && i.photos.length > 0
          ? i.photos.map((photo, idx) => `Foto ${idx + 1}`).join(' | ')
          : 'Sem foto';
        
        return [
          i.codigo.toString(),
          i.descricao,
          i.pavimento,
          i.installed ? 'Instalado' : 'Pendente',
          i.observacoes || '',
          photoLinks
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] }, // Red for urgency
      didDrawCell: (data) => {
        // Adicionar links clicáveis para fotos
        if (data.section === 'body' && data.column.index === 5) {
          const installation = pendencias[data.row.index];
          if (installation.photos && installation.photos.length > 0) {
            const cellY = data.cell.y + 2;
            let linkX = data.cell.x + 2;
            
            installation.photos.forEach((photoUrl, idx) => {
              const linkText = `Foto ${idx + 1}`;
              const linkWidth = doc.getTextWidth(linkText);
              
              // Adicionar link clicável
              doc.setTextColor(0, 0, 255); // Azul para links
              doc.textWithLink(linkText, linkX, cellY + 3, {
                url: photoUrl
              });
              
              linkX += linkWidth + doc.getTextWidth(' | ');
              doc.setTextColor(0, 0, 0); // Resetar para preto
            });
          }
        }
      }
    });
    
    yPosition = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPosition + 20;
  }
  
  // Próximos Passos
  if (proximosPassos.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(16);
    doc.text('PRÓXIMOS PASSOS', 20, yPosition);
    yPosition += 10;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Código', 'Descrição', 'Pavimento', 'Tipologia', 'Quantidade']],
      body: proximosPassos.map(i => [
        i.codigo.toString(),
        i.descricao,
        i.pavimento,
        i.tipologia,
        i.quantidade.toString()
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 193, 7] }, // Yellow for warning
    });
    
    yPosition = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPosition + 20;
  }
  
  // Instaladas (sem observações)
  if (instaladas.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(16);
    doc.text('INSTALADAS (SEM OBSERVAÇÕES)', 20, yPosition);
    yPosition += 10;
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Código', 'Descrição', 'Pavimento', 'Instalado em']],
      body: instaladas.map(i => [
        i.codigo.toString(),
        i.descricao,
        i.pavimento,
        i.installed_at ? new Date(i.installed_at).toLocaleDateString('pt-BR') : ''
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 135, 84] }, // Green for success
    });
  }
  
  // Campo de assinatura
  const docWithTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } });
  const finalY = docWithTable.lastAutoTable?.finalY || yPosition;
  if (finalY > 220) {
    doc.addPage();
  }
  
  const signatureY = docWithTable.lastAutoTable?.finalY ? docWithTable.lastAutoTable.finalY + 40 : yPosition + 40;
  doc.setFontSize(12);
  doc.text('Assinatura do Responsável:', 20, signatureY);
  doc.line(20, signatureY + 20, 100, signatureY + 20);
  
  // Download
  doc.save(`relatorio-${project.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`);
}

export function generateXLSXReport(data: ReportData): void {
  const { project, installations, generatedBy, generatedAt } = data;
  
  const workbook = XLSX.utils.book_new();
  
  // Separar dados
  const pendencias = installations.filter(i => i.observacoes && i.observacoes.trim() !== '');
  const proximosPassos = installations.filter(i => !i.installed && (!i.observacoes || i.observacoes.trim() === ''));
  const instaladas = installations.filter(i => i.installed && (!i.observacoes || i.observacoes.trim() === ''));
  
  // Cabeçalho
  const headerData = [
    ['Relatório de Instalações - DEA Manager'],
    [''],
    ['Projeto:', project.name],
    ['Cliente:', project.client],
    ['Cidade:', project.city],
    ['Data do Relatório:', new Date(generatedAt).toLocaleDateString('pt-BR')],
    ['Responsável:', generatedBy],
    ['']
  ];
  
  // Aba Resumo
  const resumoData = [
    ...headerData,
    ['RESUMO GERAL'],
    [''],
    ['Total de Itens:', installations.length],
    ['Instalados:', instaladas.length],
    ['Pendências:', pendencias.length],
    ['Próximos Passos:', proximosPassos.length],
    ['Progresso:', `${Math.round((instaladas.length / installations.length) * 100)}%`]
  ];
  
  const resumoWS = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(workbook, resumoWS, 'Resumo');
  
  // Aba Pendências
  if (pendencias.length > 0) {
    const pendenciasData = [
      ['PENDÊNCIAS'],
      [''],
      ['Código', 'Descrição', 'Pavimento', 'Tipologia', 'Status', 'Observações'],
      ...pendencias.map(i => [
        i.codigo,
        i.descricao,
        i.pavimento,
        i.tipologia,
        i.installed ? 'Instalado' : 'Pendente',
        i.observacoes || ''
      ])
    ];
    
    const pendenciasWS = XLSX.utils.aoa_to_sheet(pendenciasData);
    XLSX.utils.book_append_sheet(workbook, pendenciasWS, 'Pendências');
  }
  
  // Aba Próximos Passos
  if (proximosPassos.length > 0) {
    const proximosData = [
      ['PRÓXIMOS PASSOS'],
      [''],
      ['Código', 'Descrição', 'Pavimento', 'Tipologia', 'Quantidade'],
      ...proximosPassos.map(i => [
        i.codigo,
        i.descricao,
        i.pavimento,
        i.tipologia,
        i.quantidade
      ])
    ];
    
    const proximosWS = XLSX.utils.aoa_to_sheet(proximosData);
    XLSX.utils.book_append_sheet(workbook, proximosWS, 'Próximos Passos');
  }
  
  // Aba Instaladas
  if (instaladas.length > 0) {
    const instaladasData = [
      ['INSTALADAS (SEM OBSERVAÇÕES)'],
      [''],
      ['Código', 'Descrição', 'Pavimento', 'Tipologia', 'Instalado em'],
      ...instaladas.map(i => [
        i.codigo,
        i.descricao,
        i.pavimento,
        i.tipologia,
        i.installed_at ? new Date(i.installed_at).toLocaleDateString('pt-BR') : ''
      ])
    ];
    
    const instaladasWS = XLSX.utils.aoa_to_sheet(instaladasData);
    XLSX.utils.book_append_sheet(workbook, instaladasWS, 'Instaladas');
  }
  
  // Download
  XLSX.writeFile(workbook, `relatorio-${project.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.xlsx`);
}