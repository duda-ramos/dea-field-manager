#!/usr/bin/env node

/**
 * Script para preparar dados de teste para validação do sistema de revisões
 * 
 * Este script cria instalações com múltiplas revisões para facilitar os testes manuais
 */

import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker/locale/pt_BR';

// Configuração do Supabase (ajustar conforme necessário)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Tipos de revisão para teste
const revisionTypes = [
  'problema-instalacao',
  'revisao-conteudo',
  'desaprovado-cliente',
  'outros'
];

const revisionDescriptions = {
  'problema-instalacao': [
    'Altura incorreta detectada durante vistoria',
    'Posicionamento fora do padrão especificado',
    'Material diferente do aprovado'
  ],
  'revisao-conteudo': [
    'Atualização das especificações técnicas',
    'Correção de código do item',
    'Ajuste na quantidade solicitada'
  ],
  'desaprovado-cliente': [
    'Cliente solicitou mudança de localização',
    'Alteração no design conforme feedback',
    'Substituição por modelo alternativo'
  ],
  'outros': [
    'Ajuste administrativo',
    'Correção de dados',
    'Atualização de observações'
  ]
};

async function createTestInstallation(projectId: string, index: number) {
  console.log(`\n📦 Criando instalação de teste ${index + 1}...`);

  // Dados base da instalação
  const baseData = {
    project_id: projectId,
    tipologia: faker.helpers.arrayElement(['Placa de Sinalização', 'Extintor', 'Hidrante', 'Luminária de Emergência']),
    codigo: `TEST-${faker.string.alphanumeric(6).toUpperCase()}`,
    descricao: faker.commerce.productDescription(),
    quantidade: faker.number.int({ min: 1, max: 10 }),
    pavimento: faker.helpers.arrayElement(['Térreo', '1º Pavimento', '2º Pavimento', 'Subsolo', 'Cobertura']),
    local: faker.helpers.arrayElement(['Corredor Principal', 'Sala de Reuniões', 'Recepção', 'Escada de Emergência']),
    diretriz_altura_cm: faker.number.int({ min: 100, max: 250 }),
    diretriz_dist_batente_cm: faker.number.int({ min: 10, max: 50 }),
    installed: false,
    revisado: false,
    revisao: 0,
    observacoes: index === 0 ? 'Instalação de teste com apenas uma revisão (criação)' : '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Criar instalação inicial
  const { data: installation, error } = await supabase
    .from('project_installations')
    .insert(baseData)
    .select()
    .single();

  if (error || !installation) {
    console.error('❌ Erro ao criar instalação:', error);
    return null;
  }

  console.log(`✅ Instalação criada: ${installation.codigo}`);

  // Criar primeira revisão (criação)
  await createRevision(installation.id, 1, 'created', null, installation);

  let currentInstallation = installation;

  // Criar revisões adicionais baseado no índice
  if (index > 0) {
    const numRevisions = index === 1 ? 3 : index === 2 ? 5 : 8;

    for (let i = 2; i <= numRevisions; i++) {
      // Simular alterações progressivas
      const changes = generateRandomChanges(currentInstallation, i);

      const updatedAt = new Date().toISOString();
      const nextInstallationState = {
        ...currentInstallation,
        ...changes,
        revisado: true,
        revisao: i,
        updated_at: updatedAt
      };

      // Tipo de revisão
      const type = i === numRevisions && index === 3 ? 'restored' :
                   faker.helpers.arrayElement(revisionTypes);

      const description = type === 'restored' ? 
        'Restauração para versão anterior' :
        faker.helpers.arrayElement(revisionDescriptions[type as keyof typeof revisionDescriptions]);

      // Criar revisão
      await createRevision(
        installation.id,
        i,
        type === 'restored' ? 'restored' : 'edited',
        {
          motivo: type,
          descricao_motivo: description
        },
        nextInstallationState
      );

      // Atualizar instalação com as mudanças
      const { error: updateError } = await supabase
        .from('project_installations')
        .update({
          ...changes,
          revisado: true,
          revisao: i,
          updated_at: updatedAt
        })
        .eq('id', installation.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar instalação para revisão ${i}:`, updateError);
      } else {
        console.log(`  ↳ Revisão ${i} criada: ${type} - ${description}`);
        currentInstallation = nextInstallationState;
      }

      // Delay para simular tempo entre revisões
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return currentInstallation;
}

async function createRevision(
  installationId: string,
  revisionNumber: number,
  type: string,
  metadata: any,
  snapshot: any
) {
  const { error } = await supabase
    .from('item_versions')
    .insert({
      instalacao_id: installationId,
      revisao: revisionNumber,
      type,
      motivo: metadata?.motivo,
      descricao_motivo: metadata?.descricao_motivo,
      snapshot: {
        ...snapshot,
        id: undefined,
        created_at: undefined,
        updated_at: undefined
      },
      criado_em: new Date(Date.now() - (10 - revisionNumber) * 60 * 60 * 1000).toISOString() // Simular tempo passado
    });

  if (error) {
    console.error(`❌ Erro ao criar revisão ${revisionNumber}:`, error);
  }
}

function generateRandomChanges(baseData: any, revisionNumber: number): any {
  const changes: any = {};
  
  // Probabilidade de mudança aumenta com o número da revisão
  const changeProb = Math.min(0.3 + (revisionNumber * 0.1), 0.8);

  if (Math.random() < changeProb) {
    changes.quantidade = faker.number.int({ min: 1, max: 20 });
  }

  if (Math.random() < changeProb * 0.8) {
    changes.pavimento = faker.helpers.arrayElement(['Térreo', '1º Pavimento', '2º Pavimento', 'Subsolo', 'Cobertura']);
  }

  if (Math.random() < changeProb * 0.6) {
    changes.diretriz_altura_cm = faker.number.int({ min: 100, max: 250 });
  }

  if (Math.random() < changeProb * 0.5) {
    changes.local = faker.helpers.arrayElement(['Corredor Principal', 'Sala de Reuniões', 'Recepção', 'Escada de Emergência', 'Área Externa']);
  }

  if (Math.random() < changeProb * 0.4) {
    changes.observacoes = faker.lorem.sentence();
  }

  if (Math.random() < changeProb * 0.3) {
    changes.installed = !baseData.installed;
  }

  // Garantir pelo menos uma mudança
  if (Object.keys(changes).length === 0) {
    changes.observacoes = `Atualização de teste - Revisão ${revisionNumber}`;
  }

  return changes;
}

async function main() {
  console.log('🚀 Iniciando criação de dados de teste para o sistema de revisões\n');

  // Verificar se há um projeto de teste ou criar um
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .ilike('name', '%teste%revisão%')
    .limit(1);

  let projectId: string;

  if (!projects || projects.length === 0) {
    console.log('📋 Criando projeto de teste...');
    
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        name: `Teste Sistema de Revisões - ${new Date().toLocaleDateString('pt-BR')}`,
        client: 'Cliente Teste',
        status: 'em_andamento',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error || !newProject) {
      console.error('❌ Erro ao criar projeto:', error);
      process.exit(1);
    }

    projectId = newProject.id;
    console.log(`✅ Projeto criado: ${newProject.name}`);
  } else {
    projectId = projects[0].id;
    console.log(`📋 Usando projeto existente: ${projects[0].name}`);
  }

  // Criar instalações de teste
  const testScenarios = [
    { name: 'Instalação Nova (1 revisão)', revisions: 1 },
    { name: 'Instalação com Poucas Revisões (3)', revisions: 3 },
    { name: 'Instalação com Várias Revisões (5)', revisions: 5 },
    { name: 'Instalação com Muitas Revisões e Restauração (8)', revisions: 8 }
  ];

  console.log('\n📦 Criando instalações de teste...\n');

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`\n${i + 1}. ${scenario.name}`);
    await createTestInstallation(projectId, i);
  }

  console.log('\n✅ Dados de teste criados com sucesso!');
  console.log(`\n📌 Acesse o projeto "${projects?.[0]?.name || 'Teste Sistema de Revisões'}" para validar o sistema de revisões.`);
  console.log('\n📋 Cenários de teste disponíveis:');
  testScenarios.forEach((scenario, i) => {
    console.log(`   ${i + 1}. ${scenario.name}`);
  });
}

// Executar script
main().catch(console.error);
