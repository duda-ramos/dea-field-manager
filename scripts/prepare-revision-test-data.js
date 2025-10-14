#!/usr/bin/env node

/**
 * Script para preparar dados de teste para validação do sistema de revisões
 * 
 * Este script cria instalações com múltiplas revisões para facilitar os testes manuais
 */

import('dotenv/config');

console.log('🚀 Script de preparação de dados de teste');
console.log('\n⚠️  Este script requer configuração manual:');
console.log('1. Instale as dependências: npm install @supabase/supabase-js @faker-js/faker');
console.log('2. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
console.log('3. Execute: node scripts/prepare-revision-test-data.js');
console.log('\n📝 Alternativamente, crie os dados de teste manualmente seguindo o guia VALIDACAO_MANUAL_REVISOES.md');