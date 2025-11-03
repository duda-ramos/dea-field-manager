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
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Paleta de cores
  const colors = {
    primary: [30, 64, 175] as [number, number, number],
    success: [5, 150, 105] as [number, number, number],
    warning: [245, 158, 11] as [number, number, number],
    danger: [220, 38, 38] as [number, number, number],
    neutral: [107, 114, 128] as [number, number, number],
    lightBg: [249, 250, 251] as [number, number, number],
    border: [229, 231, 235] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
  };
  
  // ==================== CABEÇALHO COM BACKGROUND ====================
  // Faixa azul no topo
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Logo em box branco arredondado
  try {
    const logoImg = new Image();
    logoImg.src = '/logo-dea.png';
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
    });
    
    const maxWidth = 35;
    const aspectRatio = logoImg.width / logoImg.height;
    const logoWidth = maxWidth;
    const logoHeight = maxWidth / aspectRatio;
    
    // Box branco para logo
    doc.setFillColor(...colors.white);
    doc.roundedRect(15, 8, logoWidth + 6, logoHeight + 6, 3, 3, 'F');
    doc.addImage(logoImg, 'PNG', 18, 11, logoWidth, logoHeight);
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
  }
  
  // Título em branco
  doc.setTextColor(...colors.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('📋 Relatório de Instalações', 70, 20);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`Projeto: ${project.name}`, 70, 32);
  
  // Linha decorativa abaixo do cabeçalho
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.5);
  doc.line(15, 47, pageWidth - 15, 47);
  
  // ==================== CARDS DE INFORMAÇÕES DO PROJETO ====================
  doc.setTextColor(0, 0, 0);
  let yPos = 58;
  
  const cardWidth = (pageWidth - 50) / 3;
  const cardHeight = 18;
  const cardSpacing = 5;
  
  // Card Cliente
  doc.setFillColor(...colors.lightBg);
  doc.roundedRect(15, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(...colors.border);
  doc.roundedRect(15, yPos, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFontSize(9);
  doc.setTextColor(...colors.neutral);
  doc.text('👤 Cliente', 18, yPos + 6);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(project.client, 18, yPos + 13);
  
  // Card Cidade
  const cardX2 = 15 + cardWidth + cardSpacing;
  doc.setFillColor(...colors.lightBg);
  doc.roundedRect(cardX2, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(...colors.border);
  doc.roundedRect(cardX2, yPos, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFontSize(9);
  doc.setTextColor(...colors.neutral);
  doc.text('📍 Cidade', cardX2 + 3, yPos + 6);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(project.city, cardX2 + 3, yPos + 13);
  
  // Card Data
  const cardX3 = cardX2 + cardWidth + cardSpacing;
  doc.setFillColor(...colors.lightBg);
  doc.roundedRect(cardX3, yPos, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(...colors.border);
  doc.roundedRect(cardX3, yPos, cardWidth, cardHeight, 2, 2, 'S');
  doc.setFontSize(9);
  doc.setTextColor(...colors.neutral);
  doc.text('📅 Data do Relatório', cardX3 + 3, yPos + 6);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(new Date(generatedAt).toLocaleDateString('pt-BR'), cardX3 + 3, yPos + 13);
  
  doc.setFont('helvetica', 'normal');
  yPos += cardHeight + 5;
  
  // Responsável
  doc.setFontSize(10);
  doc.setTextColor(...colors.neutral);
  doc.text(`Responsável: ${generatedBy}`, 15, yPos + 5);
  
  // Separar instalações por categoria
  const pendencias = installations.filter(i => i.observacoes && i.observacoes.trim() !== '');
  const proximosPassos = installations.filter(i => !i.installed && (!i.observacoes || i.observacoes.trim() === ''));
  const instaladas = installations.filter(i => i.installed && (!i.observacoes || i.observacoes.trim() === ''));
  
  // ==================== ESTATÍSTICAS VISUAIS ====================
  yPos += 15;
  
  // Cálculos
  const total = installations.length;
  const concluidas = instaladas.length;
  const emAndamento = pendencias.length;
  const proximos = proximosPassos.length;
  const progressoPct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  
  // Título da seção
  doc.setFontSize(16);
  doc.setTextColor(...colors.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('📊 Estatísticas do Projeto', 15, yPos);
  yPos += 10;
  
  // Cards de métricas (4 cards em linha)
  const metricCardWidth = (pageWidth - 50) / 4;
  const metricCardHeight = 22;
  const metricSpacing = 5;
  
  // Card 1: Total
  doc.setFillColor(...colors.lightBg);
  doc.roundedRect(15, yPos, metricCardWidth, metricCardHeight, 2, 2, 'F');
  doc.setDrawColor(...colors.border);
  doc.roundedRect(15, yPos, metricCardWidth, metricCardHeight, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...colors.neutral);
  doc.text('TOTAL', 17, yPos + 6);
  doc.setFontSize(18);
  doc.setTextColor(...colors.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(total.toString(), 17, yPos + 16);
  
  // Card 2: Concluídas
  const metric2X = 15 + metricCardWidth + metricSpacing;
  doc.setFillColor(240, 253, 244); // Verde muito claro
  doc.roundedRect(metric2X, yPos, metricCardWidth, metricCardHeight, 2, 2, 'F');
  doc.setDrawColor(...colors.success);
  doc.roundedRect(metric2X, yPos, metricCardWidth, metricCardHeight, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...colors.neutral);
  doc.text('✅ CONCLUÍDAS', metric2X + 2, yPos + 6);
  doc.setFontSize(18);
  doc.setTextColor(...colors.success);
  doc.text(concluidas.toString(), metric2X + 2, yPos + 16);
  doc.setFontSize(9);
  doc.text(`${progressoPct}%`, metric2X + 2 + doc.getTextWidth(concluidas.toString()) + 3, yPos + 16);
  
  // Card 3: Pendências
  const metric3X = metric2X + metricCardWidth + metricSpacing;
  doc.setFillColor(254, 242, 242); // Vermelho muito claro
  doc.roundedRect(metric3X, yPos, metricCardWidth, metricCardHeight, 2, 2, 'F');
  doc.setDrawColor(...colors.danger);
  doc.roundedRect(metric3X, yPos, metricCardWidth, metricCardHeight, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...colors.neutral);
  doc.text('⚠️ PENDÊNCIAS', metric3X + 2, yPos + 6);
  doc.setFontSize(18);
  doc.setTextColor(...colors.danger);
  doc.text(emAndamento.toString(), metric3X + 2, yPos + 16);
  
  // Card 4: Próximos Passos
  const metric4X = metric3X + metricCardWidth + metricSpacing;
  doc.setFillColor(255, 251, 235); // Amarelo muito claro
  doc.roundedRect(metric4X, yPos, metricCardWidth, metricCardHeight, 2, 2, 'F');
  doc.setDrawColor(...colors.warning);
  doc.roundedRect(metric4X, yPos, metricCardWidth, metricCardHeight, 2, 2, 'S');
  doc.setFontSize(8);
  doc.setTextColor(...colors.neutral);
  doc.text('📋 PRÓXIMOS', metric4X + 2, yPos + 6);
  doc.setFontSize(18);
  doc.setTextColor(...colors.warning);
  doc.text(proximos.toString(), metric4X + 2, yPos + 16);
  
  yPos += metricCardHeight + 8;
  
  // Barra de progresso
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Progresso Geral: ${progressoPct}%`, 15, yPos);
  yPos += 5;
  
  const barWidth = pageWidth - 30;
  const barHeight = 8;
  
  // Background da barra
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(15, yPos, barWidth, barHeight, 2, 2, 'F');
  
  // Progresso
  if (progressoPct > 0) {
    doc.setFillColor(...colors.success);
    doc.roundedRect(15, yPos, (barWidth * progressoPct) / 100, barHeight, 2, 2, 'F');
  }
  
  // Borda da barra
  doc.setDrawColor(...colors.border);
  doc.roundedRect(15, yPos, barWidth, barHeight, 2, 2, 'S');
  
  let yPosition = yPos + 20;
  
  // ==================== SEÇÃO PENDÊNCIAS ====================
  if (pendencias.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.danger);
    doc.text(`⚠️ PENDÊNCIAS (${pendencias.length})`, 20, yPosition);
    
    // Linha decorativa
    doc.setDrawColor(...colors.danger);
    doc.setLineWidth(0.8);
    doc.line(20, yPosition + 2, 80, yPosition + 2);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
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
      styles: { 
        fontSize: 9,
        cellPadding: 5,
        lineColor: colors.border,
        lineWidth: 0.1,
      },
      headStyles: { 
        fillColor: colors.danger,
        textColor: colors.white,
        fontSize: 10,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242], // Fundo vermelho muito claro
      },
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
    
    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    const lastY = docWithTable.lastAutoTable?.finalY ?? yPosition;
    yPosition = lastY + 20;
  }
  
  // ==================== SEÇÃO PRÓXIMOS PASSOS ====================
  if (proximosPassos.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.warning);
    doc.text(`📋 PRÓXIMOS PASSOS (${proximosPassos.length})`, 20, yPosition);
    
    // Linha decorativa
    doc.setDrawColor(...colors.warning);
    doc.setLineWidth(0.8);
    doc.line(20, yPosition + 2, 90, yPosition + 2);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
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
      styles: { 
        fontSize: 9,
        cellPadding: 5,
        lineColor: colors.border,
        lineWidth: 0.1,
      },
      headStyles: { 
        fillColor: colors.warning,
        textColor: [0, 0, 0],
        fontSize: 10,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      alternateRowStyles: {
        fillColor: [255, 251, 235], // Fundo amarelo muito claro
      },
    });
    
    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    const lastY = docWithTable.lastAutoTable?.finalY ?? yPosition;
    yPosition = lastY + 20;
  }
  
  // ==================== SEÇÃO INSTALADAS ====================
  if (instaladas.length > 0) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.success);
    doc.text(`✅ INSTALADAS (${instaladas.length})`, 20, yPosition);
    
    // Linha decorativa
    doc.setDrawColor(...colors.success);
    doc.setLineWidth(0.8);
    doc.line(20, yPosition + 2, 75, yPosition + 2);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
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
      styles: { 
        fontSize: 9,
        cellPadding: 5,
        lineColor: colors.border,
        lineWidth: 0.1,
      },
      headStyles: { 
        fillColor: colors.success,
        textColor: colors.white,
        fontSize: 10,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244], // Fundo verde muito claro
      },
    });
  }
  
  // ==================== CAMPO DE ASSINATURA ====================
  const docWithTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } });
  const finalY = docWithTable.lastAutoTable?.finalY || yPosition;
  if (finalY > 220) {
    doc.addPage();
  }
  
  const signatureY = docWithTable.lastAutoTable?.finalY ? docWithTable.lastAutoTable.finalY + 30 : yPosition + 30;
  
  // Box decorativo para assinatura
  doc.setFillColor(...colors.lightBg);
  doc.roundedRect(15, signatureY, pageWidth - 30, 35, 3, 3, 'F');
  doc.setDrawColor(...colors.border);
  doc.roundedRect(15, signatureY, pageWidth - 30, 35, 3, 3, 'S');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('✍️ Assinatura do Responsável', 20, signatureY + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...colors.neutral);
  
  // Linha para assinatura
  doc.setDrawColor(...colors.neutral);
  doc.line(20, signatureY + 25, pageWidth - 20, signatureY + 25);
  
  doc.text('Nome:', 20, signatureY + 30);
  doc.text('Data: ___/___/______', pageWidth - 60, signatureY + 30);
  
  // ==================== RODAPÉ MODERNO ====================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 15;
    
    // Linha decorativa no topo do rodapé
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    
    // Conteúdo do rodapé
    doc.setFontSize(8);
    doc.setTextColor(...colors.neutral);
    doc.setFont('helvetica', 'normal');
    
    // Página (esquerda)
    doc.text(`Página ${i} de ${totalPages}`, 15, footerY);
    
    // Nome do projeto (centro)
    const projectText = project.name;
    const projectTextWidth = doc.getTextWidth(projectText);
    doc.text(projectText, (pageWidth - projectTextWidth) / 2, footerY);
    
    // Data (direita)
    const dateText = new Date(generatedAt).toLocaleDateString('pt-BR');
    doc.text(dateText, pageWidth - 15 - doc.getTextWidth(dateText), footerY);
  }
  
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