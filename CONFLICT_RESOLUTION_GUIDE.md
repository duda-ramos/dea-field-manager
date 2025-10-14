# Guia de Resolução de Conflitos

## Visão Geral

O sistema de resolução de conflitos do Cursor gerencia automaticamente situações onde múltiplas operações tentam modificar o mesmo recurso simultaneamente. O sistema utiliza a estratégia **Last Write Wins (LWW)** como padrão, garantindo que as operações mais recentes tenham precedência.

## Como Funciona

### 1. Detecção de Conflitos

O sistema detecta conflitos quando:
- Múltiplas operações tentam modificar o mesmo arquivo
- Operações concorrentes ocorrem no mesmo diretório
- Mudanças sobrepostas são detectadas em tempo real

### 2. Fluxo de Resolução

```
┌─────────────────┐
│ Nova Operação   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Detectar        │
│ Conflitos       │
└────────┬────────┘
         │
         v
    ┌────┴────┐
    │Conflito? │
    └────┬────┘
         │
    ┌────┴────┬─────────┐
    │   Sim   │   Não   │
    v         v         v
┌────────┐  ┌───────────┐
│Resolver│  │ Executar  │
│com LWW │  │ Operação  │
└────┬───┘  └───────────┘
     │
     v
┌────────────┐
│ Notificar  │
│ Usuário    │
└────────────┘
```

### 3. Estratégia Last Write Wins (LWW)

A estratégia LWW funciona assim:

1. **Timestamp**: Cada operação recebe um timestamp único
2. **Comparação**: Quando há conflito, compara-se os timestamps
3. **Resolução**: A operação mais recente vence
4. **Notificação**: O usuário é informado sobre a resolução

## Tipos de Conflito

### 1. Conflito de Arquivo
- **Situação**: Duas operações modificam o mesmo arquivo
- **Resolução**: A modificação mais recente é mantida
- **Exemplo**: Dois usuários editando `config.json`

### 2. Conflito de Diretório
- **Situação**: Operações conflitantes em estrutura de diretórios
- **Resolução**: Operação mais recente prevalece
- **Exemplo**: Criar e deletar pasta simultaneamente

### 3. Conflito de Renomeação
- **Situação**: Múltiplas tentativas de renomear o mesmo recurso
- **Resolução**: Nome mais recente é aplicado
- **Exemplo**: Renomear `old.txt` para nomes diferentes

## Opções de Resolução

### 1. Automática (Padrão)
```typescript
// Sistema resolve automaticamente com LWW
conflictResolution: {
  strategy: 'lastWriteWins',
  automatic: true
}
```

### 2. Manual
```typescript
// Usuário escolhe qual versão manter
conflictResolution: {
  strategy: 'manual',
  promptUser: true
}
```

### 3. Merge
```typescript
// Tenta mesclar mudanças (para arquivos de texto)
conflictResolution: {
  strategy: 'merge',
  algorithm: 'three-way'
}
```

## Quando Usar Cada Opção

### Use LWW (Padrão) quando:
- ✅ Velocidade é prioridade
- ✅ Mudanças são incrementais
- ✅ Perder algumas mudanças é aceitável
- ✅ Ambiente colaborativo com alta frequência de edições

### Use Manual quando:
- ✅ Cada mudança é crítica
- ✅ Contexto humano é necessário
- ✅ Arquivos sensíveis (configurações, segurança)
- ✅ Baixa frequência de conflitos

### Use Merge quando:
- ✅ Arquivos de código fonte
- ✅ Documentação colaborativa
- ✅ Mudanças são complementares
- ✅ Preservar todas as contribuições é importante

## FAQ

### P: O que acontece com as mudanças "perdidas"?
**R**: O sistema mantém um histórico de todas as operações. Mudanças sobrescritas podem ser recuperadas através do histórico de conflitos.

### P: Posso mudar a estratégia de resolução?
**R**: Sim, a estratégia pode ser configurada globalmente ou por tipo de arquivo nas configurações do projeto.

### P: Como sei quando um conflito foi resolvido?
**R**: O sistema exibe uma notificação toast informando sobre o conflito e sua resolução. Detalhes completos estão disponíveis no log de conflitos.

### P: Conflitos afetam a performance?
**R**: A detecção e resolução de conflitos é otimizada para ser rápida. O impacto na performance é mínimo, geralmente < 10ms por operação.

### P: Posso desabilitar a resolução automática?
**R**: Sim, mas não é recomendado. Defina `conflictResolution.automatic: false` nas configurações.

### P: O que é um "conflito fantasma"?
**R**: São conflitos detectados mas que já foram resolvidos por outra operação. O sistema os ignora automaticamente.

## Melhores Práticas

1. **Comunique-se**: Em ambientes colaborativos, comunique grandes mudanças
2. **Commits Frequentes**: Faça commits pequenos e frequentes
3. **Sincronize**: Mantenha seu workspace sincronizado
4. **Revise Logs**: Verifique o histórico de conflitos periodicamente
5. **Configure**: Ajuste a estratégia conforme suas necessidades

## Configuração Avançada

### Personalizar por Tipo de Arquivo
```json
{
  "conflictResolution": {
    "*.json": "manual",
    "*.md": "merge",
    "*": "lastWriteWins"
  }
}
```

### Callbacks de Resolução
```typescript
onConflictResolved: (conflict, resolution) => {
  // Lógica customizada após resolução
  console.log(`Conflito em ${conflict.path} resolvido com ${resolution.strategy}`);
}
```

## Troubleshooting

### Conflitos Frequentes
- Verifique se múltiplos processos estão modificando os mesmos arquivos
- Considere usar estratégia manual para arquivos críticos
- Revise logs para identificar padrões

### Performance Degradada
- Verifique o tamanho do histórico de conflitos
- Limpe conflitos antigos periodicamente
- Otimize watchers de arquivo

### Resoluções Incorretas
- Verifique a sincronização de relógio entre sistemas
- Confirme que timestamps estão corretos
- Considere usar IDs únicos além de timestamps

## Suporte

Para problemas ou sugestões relacionadas ao sistema de resolução de conflitos:
1. Verifique os logs em `.cursor/conflicts/`
2. Consulte a documentação técnica em `/docs/`
3. Abra uma issue no repositório do projeto