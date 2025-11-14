import type { Project, Installation, FileAttachment } from '@/types';

/**
 * Test fixture: Mock project
 */
export function createMockProject(overrides?: Partial<Project>): Project {
  const now = new Date().toISOString();
  return {
    id: 'project-1',
    name: 'Test Project',
    client: 'Test Client',
    city: 'São Paulo',
    code: 'PROJ-001',
    status: 'in-progress',
    owner: 'test-user-id',
    suppliers: ['Supplier A', 'Supplier B'],
    created_at: now,
    updated_at: now,
    user_id: 'test-user-id',
    ...overrides,
  };
}

/**
 * Test fixture: Mock installation
 */
export function createMockInstallation(overrides?: Partial<Installation>): Installation {
  const now = new Date().toISOString();
  return {
    id: 'installation-1',
    projectId: 'project-1',
    project_id: 'project-1',
    identificacao: 'INST-001',
    status: 'pendente',
    pavimento: '1° Andar',
    local: 'Sala 101',
    observacao: 'Test observation',
    tipoEquipamento: 'Test Equipment',
    tipo_equipamento: 'Test Equipment',
    created_at: now,
    updated_at: now,
    ...overrides,
  } as Installation;
}

/**
 * Test fixture: Mock file attachment
 */
export function createMockFileAttachment(overrides?: Partial<FileAttachment>): FileAttachment {
  const now = new Date().toISOString();
  return {
    id: 'file-1',
    projectId: 'project-1',
    project_id: 'project-1',
    name: 'test-image.jpg',
    size: 1024000,
    type: 'image/jpeg',
    storagePath: 'projects/project-1/test-image.jpg',
    uploadedAt: now,
    uploaded_at: now,
    created_at: now,
    ...overrides,
  };
}

/**
 * Test fixture: Multiple projects
 */
export function createMockProjects(count: number): Project[] {
  return Array.from({ length: count }, (_, i) =>
    createMockProject({
      id: `project-${i + 1}`,
      code: `PROJ-${String(i + 1).padStart(3, '0')}`,
      name: `Test Project ${i + 1}`,
    })
  );
}

/**
 * Test fixture: Multiple installations
 */
export function createMockInstallations(projectId: string, count: number): Installation[] {
  return Array.from({ length: count }, (_, i) =>
    createMockInstallation({
      id: `installation-${i + 1}`,
      projectId,
      project_id: projectId,
      identificacao: `INST-${String(i + 1).padStart(3, '0')}`,
      pavimento: `${Math.floor(i / 10) + 1}° Andar`,
      local: `Sala ${100 + i + 1}`,
    })
  );
}

/**
 * Test fixture: Multiple file attachments
 */
export function createMockFileAttachments(projectId: string, count: number): FileAttachment[] {
  return Array.from({ length: count }, (_, i) =>
    createMockFileAttachment({
      id: `file-${i + 1}`,
      projectId,
      project_id: projectId,
      name: `test-image-${i + 1}.jpg`,
      storagePath: `projects/${projectId}/test-image-${i + 1}.jpg`,
    })
  );
}

/**
 * Test fixture: Profile data
 */
export function createMockProfile(overrides?: any) {
  return {
    id: 'test-user-id',
    display_name: 'Test User',
    avatar_url: null,
    role: 'manager' as const,
    role_metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
