export { default as ContatosPage } from './routes/ContatosPage';
export { ContatoForm } from './components/ContatoForm';
export { ContatoList } from './components/ContatoList';

export type Contato = {
  id: string;
  projetoId: string;
  tipo: "cliente" | "obra" | "fornecedor";
  nome: string;
  empresa?: string;
  telefone?: string;
  email?: string;
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
};