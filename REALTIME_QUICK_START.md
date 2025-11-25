# 🚀 Guia Rápido - Sincronização em Tempo Real

## ⚡ Início Rápido (5 minutos)

### 1. Aplicar Migration no Supabase ⚠️ **OBRIGATÓRIO**

**Opção A - Via CLI**:
```bash
cd /workspace
supabase db push
```

**Opção B - Via Dashboard** (se não tiver CLI):
1. Acesse https://supabase.com/dashboard
2. Abra seu projeto
3. Vá em **SQL Editor**
4. Cole o conteúdo de: `supabase/migrations/20251125140000_enable_realtime_for_all_tables.sql`
5. Execute (RUN)

### 2. Reiniciar o Servidor
```bash
npm run dev
```

### 3. Verificar Status

Abra a aplicação e verifique:
- [ ] Badge "Realtime: ON" está verde (canto superior direito)
- [ ] Console do navegador mostra: `Realtime: Subscribed to projects`

### 4. Testar

Abra duas abas/dispositivos:
1. **Aba 1**: Crie um projeto
2. **Aba 2**: Deve aparecer automaticamente em 2-3 segundos ✨

---

## ✅ O que foi corrigido?

### Arquivo `.env`
✅ Adicionado `VITE_REALTIME_ENABLED=true`

### Arquivo `src/lib/preferences.ts`
✅ Mudado `realtimeEnabled: false` → `true`

### Migration criada
✅ Arquivo: `supabase/migrations/20251125140000_enable_realtime_for_all_tables.sql`

---

## 🔍 Como Verificar se está Funcionando?

### Método 1: Visual (mais fácil)
1. Abra a aplicação
2. Clique no ícone de sync (canto superior direito)
3. Veja o badge **"Realtime: ON"** em verde

### Método 2: Console
1. Abra DevTools (F12)
2. Procure por logs:
   ```
   [INFO] Realtime initialized: client_...
   [INFO] Realtime: Subscribed to projects
   ```

### Método 3: Teste Prático
1. Abra 2 abas do navegador
2. Faça login nas duas
3. Crie um projeto na aba 1
4. Veja aparecer na aba 2 automaticamente

---

## ⚠️ Problemas Comuns

### "Realtime: OFF" aparece no badge

**Causa**: Migration não foi aplicada no Supabase

**Solução**:
```bash
cd /workspace
supabase db push
```

### Sem logs no console

**Causa**: Variável de ambiente não foi carregada

**Solução**:
1. Verifique `.env` contém `VITE_REALTIME_ENABLED=true`
2. Reinicie o servidor: `Ctrl+C` e `npm run dev`

### Eventos não aparecem

**Causa**: Precisa limpar localStorage das preferências antigas

**Solução**:
1. Abra DevTools (F12)
2. Console:
   ```javascript
   localStorage.removeItem('sync_preferences')
   location.reload()
   ```

---

## 📊 Métricas para Monitorar

No **Painel de Status da Sincronização**:

| Métrica | O que significa | Esperado |
|---------|----------------|----------|
| **Realtime: ON** | Sistema ativo | Verde |
| **Events Received** | Eventos recebidos | Incrementa com mudanças |
| **Events Applied** | Eventos aplicados | ~95% dos recebidos |
| **Events Ignored** | Duplicatas do próprio cliente | Normal ter alguns |
| **Last Event** | Último evento | Recente se houver atividade |

---

## 🎯 Testes Recomendados

### Teste 1: Criar Projeto
- [ ] Criar projeto em uma aba
- [ ] Aparecer em outra aba automaticamente

### Teste 2: Editar Projeto
- [ ] Editar nome do projeto
- [ ] Atualizar na outra aba

### Teste 3: Criar Instalação
- [ ] Adicionar instalação a um projeto
- [ ] Aparecer na lista da outra aba

### Teste 4: Adicionar Foto
- [ ] Upload de foto em uma aba
- [ ] Aparecer na galeria da outra aba

### Teste 5: Latência
- [ ] Tempo de propagação < 3 segundos
- [ ] Sem erros no console

---

## 📚 Documentação Completa

Para mais detalhes, veja:
- **[REALTIME_SYNC_FIX.md](./REALTIME_SYNC_FIX.md)** - Documentação completa da correção
- **[SYNC_SYSTEM.md](./docs/SYNC_SYSTEM.md)** - Como funciona o sistema de sincronização

---

## 🆘 Precisa de Ajuda?

1. Verifique `REALTIME_SYNC_FIX.md` seção "Solução de Problemas"
2. Execute o script de verificação:
   ```bash
   ./scripts/apply-realtime-migration.sh
   ```
3. Verifique logs no console do navegador (F12)

---

**Status Atual**:
- ✅ Cliente configurado
- ⏳ Migration aguardando aplicação no servidor
- ⏳ Testes pendentes

**Tempo Estimado para Aplicar**: 5 minutos
