import { describe, it, expect } from 'vitest';
import { calculateReportSections, calculatePavimentoSummary, generateFileName, type ReportData } from './reports-new';
import type { Installation, Project, ItemVersion } from '@/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Projeto X',
    client: 'Cliente Y',
    city: 'Cidade Z',
    code: 'C-001',
    status: 'in-progress',
    owner: 'Owner',
    suppliers: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Project;
}

function makeInstallation(overrides: Partial<Installation> = {}): Installation {
  return {
    id: crypto.randomUUID(),
    project_id: 'p1',
    tipologia: 'Porta',
    codigo: 101,
    descricao: 'Porta de madeira',
    quantidade: 1,
    pavimento: '1',
    installed: false,
    updated_at: new Date().toISOString(),
    photos: [],
    revisado: false,
    revisao: 0,
    ...overrides,
  } as Installation;
}

function _makeVersion(installationId: string, overrides: Partial<ItemVersion> = {}): ItemVersion {
  return {
    id: crypto.randomUUID(),
    installationId,
    snapshot: {},
    revisao: 1,
    motivo: 'created',
    criadoEm: new Date().toISOString(),
    ...overrides,
  } as ItemVersion;
}

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    project: makeProject(),
    installations: [],
    versions: [],
    generatedBy: 'tester',
    generatedAt: new Date().toISOString(),
    interlocutor: 'cliente',
    ...overrides,
  };
}

describe('reports-new core helpers', () => {
  it('calculateReportSections splits by status and pendencies', () => {
    const items: Installation[] = [
      makeInstallation({ installed: true }),
      makeInstallation({ observacoes: 'pendência' }),
      makeInstallation({ revisao: 2 }),
      makeInstallation({ installed: false }),
    ];

    const sections = calculateReportSections(makeReportData({ installations: items }));
    expect(sections.concluidas.length).toBe(1);
    expect(sections.pendencias.length).toBe(1);
    expect(sections.emRevisao.length).toBe(1);
    expect(sections.emAndamento.length).toBe(1);
  });

  it('calculatePavimentoSummary aggregates and sorts pavimentos', () => {
    const items: Installation[] = [
      makeInstallation({ pavimento: '2', installed: true }),
      makeInstallation({ pavimento: '1', observacoes: 'x' }),
      makeInstallation({ pavimento: '10', installed: false }),
    ];
    const sections = calculateReportSections(makeReportData({ installations: items }));
    const summary = calculatePavimentoSummary(sections);
    expect(summary.map(s => s.pavimento)).toEqual(['1', '2', '10']);
  });

  it('generateFileName includes project name, date and extension', () => {
    const proj = makeProject({ name: 'Alpha' });
    const name = generateFileName(proj, 'cliente', 'pdf');
    expect(name).toMatch(/Relatorio_Instalacoes_Alpha_\d{4}-\d{2}-\d{2}_CLIENTE\.pdf/);
  });
});
