import type { BulkItem } from './BulkOperationPanel.types';

export const getItemDisplayName = (item: BulkItem): string => {
  if ('name' in item && typeof item.name === 'string' && item.name.trim().length > 0) {
    return item.name;
  }

  if ('descricao' in item && typeof item.descricao === 'string') {
    return item.descricao;
  }

  if ('supplier' in item && typeof item.supplier === 'string') {
    return item.supplier;
  }

  if ('nome' in item && typeof item.nome === 'string' && item.nome.trim().length > 0) {
    return item.nome;
  }

  if ('role' in item && typeof item.role === 'string') {
    return item.role;
  }

  return 'Item';
};
