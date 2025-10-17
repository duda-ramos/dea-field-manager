# Sistema de Sincronização - DEA Field Manager

## Arquitetura
- Offline-First confirmado
- Fluxo: IndexedDB → Supabase (quando online)

## Funcionalidades
- Auto-pull no boot (configurável)
- Debounced push após 3s de edições
- Periodic pull (1/5/10/15/30 min)
- Auto-sync ao reconectar (debounce 2s)

## Configurações
- Via UI: Botão sync → ⚙️ Settings
- Via código: `src/lib/preferences.ts`

## Troubleshooting
**"Dados não sincronizam"**
1. Verifique conexão (ícone WiFi)
2. Veja badge "X pendentes"
3. Clique manual em sync
4. Verifique console (F12) para erros

**"Sync lento"**
1. Verifique Network em DevTools
2. Batch size atual: 500 (ajustável)
3. Considere reduzir para 300 em 3G

**"Boot muito lento"**
1. Desabilite auto-pull on boot em Settings
2. Faça sync manual quando necessário

## Logs e Debug
Ativar modo debug:
```javascript
localStorage.setItem('DEBUG', 'sync,storage');
```

Estrutura dos logs:
- `[SYNC]` = operações de sincronização
- `[STORAGE]` = operações IndexedDB
- Métricas ao final: pushed/pulled/errors

## Métricas
- Tempo médio de sync: [observar em produção]
- Taxa de sucesso: [observar em produção]
- Conflicts resolvidos: last-write-wins
