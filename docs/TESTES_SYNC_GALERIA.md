# 📋 Guia de Testes - Sincronização e Galeria de Fotos

Este documento contém checklist de testes manuais para validar a funcionalidade de upload, sincronização e visualização de fotos no sistema.

---

## 🎯 Objetivo

Garantir que:
- ✅ Fotos são sincronizadas automaticamente ao fazer upload
- ✅ Nomenclatura padronizada funciona corretamente
- ✅ Importação Excel sincroniza fotos existentes
- ✅ Galeria mostra fotos organizadas por instalação
- ✅ Badges visuais indicam associação com peças
- ✅ Performance mantém-se aceitável

---

## 📝 Testes Manuais

### **Teste 1 - Upload Individual**

#### Objetivo
Validar que uma única foto é enviada, sincronizada e exibida corretamente.

#### Passos
1. Abrir um projeto existente
2. Acessar uma instalação/peça específica
3. Clicar em "Capturar Foto" ou "Galeria/Arquivo"
4. Selecionar 1 foto
5. Aguardar o upload

#### Validações
- [ ] Toast de sucesso aparece informando sincronização
- [ ] Foto aparece na galeria com nome padronizado: `peca_[codigo]_[data]_001.jpg`
- [ ] Badge "Peça X" aparece no canto superior esquerdo da foto
- [ ] Ao passar o mouse, tooltip mostra:
  - Nome do arquivo
  - Data e hora de upload
  - Peça associada (código e descrição)
  - Tamanho do arquivo
- [ ] Estatísticas são atualizadas (incremento em "De Instalações")

#### Critério de Sucesso
Upload completo em < 10s (rede 4G), foto visível na galeria com badge correto.

---

### **Teste 2 - Upload Múltiplo**

#### Objetivo
Validar que múltiplas fotos são enviadas com sequencial correto.

#### Passos
1. Abrir um projeto existente
2. Acessar uma instalação/peça específica
3. Clicar em "Galeria/Arquivo"
4. Selecionar 3 fotos simultaneamente
5. Aguardar o upload de todas

#### Validações
- [ ] Barra de progresso aparece para cada foto
- [ ] Todas as 3 fotos são enviadas sem erros
- [ ] Nomenclatura sequencial correta:
  - Foto 1: `peca_[codigo]_[data]_001.jpg`
  - Foto 2: `peca_[codigo]_[data]_002.jpg`
  - Foto 3: `peca_[codigo]_[data]_003.jpg`
- [ ] Todas aparecem na galeria
- [ ] Todas têm badge "Peça X"
- [ ] Estatísticas atualizadas (+3 em "De Instalações")

#### Critério de Sucesso
Todas as fotos enviadas com sequencial correto, sincronizadas e visíveis na galeria.

---

### **Teste 3 - Importação Excel com Fotos**

#### Objetivo
Validar que fotos associadas a instalações são sincronizadas durante importação Excel.

#### Passos
1. Preparar arquivo Excel com instalações que possuem fotos salvas
2. Acessar um projeto
3. Clicar em "Importar Excel"
4. Selecionar o arquivo preparado
5. Aguardar a importação

#### Validações
- [ ] Progress bar mostra progresso em torno de 90% durante sincronização de fotos
- [ ] Console mostra logs com emojis:
  - 📤 Sincronizando foto...
  - ✅ Foto sincronizada com sucesso
  - ❌ Erro ao sincronizar (se houver problemas)
- [ ] Fotos aparecem na galeria após importação
- [ ] Cada foto está associada à instalação correta
- [ ] Badges "Peça X" corretos para cada instalação
- [ ] Nomenclatura padronizada aplicada

#### Critério de Sucesso
Importação completa com fotos sincronizadas e organizadas por instalação.

---

### **Teste 4 - Fotos Gerais (Sem Instalação)**

#### Objetivo
Validar upload de fotos gerais do projeto (não associadas a instalações).

#### Passos
1. Abrir um projeto
2. Na tela principal, acessar a galeria geral
3. Fazer upload de 2 fotos sem associação a instalação
4. Aguardar upload

#### Validações
- [ ] Fotos enviadas com nomenclatura: `arquivo_[data]_001.jpg`
- [ ] Badge "Geral" aparece nas fotos (não "Peça X")
- [ ] Tooltip mostra "📁 Foto Geral"
- [ ] Estatísticas atualizadas (+2 em "Gerais")
- [ ] Filtro "Apenas gerais" exibe somente essas fotos

#### Critério de Sucesso
Fotos gerais enviadas e diferenciadas visualmente das fotos de instalações.

---

### **Teste 5 - Performance com Upload em Massa**

#### Objetivo
Validar que o sistema mantém performance aceitável com múltiplos uploads simultâneos.

#### Passos
1. Abrir um projeto
2. Acessar uma instalação
3. Selecionar 10 fotos simultaneamente (total ~20-30MB)
4. Iniciar upload
5. Monitorar tempo e comportamento da UI

#### Validações
- [ ] Tempo total de upload < 30s (rede 4G estável)
- [ ] UI não trava durante upload
- [ ] Progress bars funcionam corretamente para todas as fotos
- [ ] Possível navegar pelo sistema durante upload
- [ ] Todas as 10 fotos sincronizadas com sucesso
- [ ] Sequencial correto (001 a 010)
- [ ] Estatísticas atualizadas corretamente

#### Critério de Sucesso
Upload completo em tempo aceitável, sem travamento de UI, todas as fotos sincronizadas.

---

### **Teste 6 - Funcionalidades da Galeria**

#### Objetivo
Validar filtros, busca e ordenação na galeria.

#### Passos
1. Ter um projeto com fotos gerais e de instalações
2. Acessar a galeria

#### Validações Filtro
- [ ] Filtro "Todas as imagens" mostra todas
- [ ] Filtro "Apenas gerais" mostra só fotos sem instalação
- [ ] Filtro "Apenas de peças" mostra só fotos de instalações

#### Validações Busca
- [ ] Buscar por nome de arquivo funciona
- [ ] Buscar por data funciona
- [ ] Buscar por código de peça funciona

#### Validações Ordenação
- [ ] Ordenar por "Data (mais recente)" funciona
- [ ] Ordenar por "Nome (A-Z)" funciona

#### Validações Estatísticas
- [ ] Card "Total de Imagens" mostra número correto
- [ ] Card "De Instalações" mostra número correto
- [ ] Card "Gerais" mostra número correto
- [ ] Estatísticas atualizam em tempo real após upload

#### Critério de Sucesso
Todos os filtros, busca e ordenação funcionando corretamente com estatísticas precisas.

---

### **Teste 7 - Edição de Imagem**

#### Objetivo
Validar funcionalidade de edição de imagens na galeria.

#### Passos
1. Acessar galeria com fotos
2. Passar o mouse sobre uma foto
3. Clicar em "Editar"
4. Fazer alterações (crop, rotate, etc.)
5. Salvar

#### Validações
- [ ] Modal de edição abre corretamente
- [ ] Ferramentas de edição funcionam
- [ ] Ao salvar, nova foto é criada
- [ ] Foto editada tem novo sequencial
- [ ] Foto editada aparece na galeria
- [ ] Foto original permanece inalterada
- [ ] Toast de sucesso aparece

#### Critério de Sucesso
Edição funciona sem afetar foto original, nova foto criada com sequencial correto.

---

### **Teste 8 - Download em Massa**

#### Objetivo
Validar download de múltiplas fotos.

#### Passos
1. Acessar galeria com múltiplas fotos
2. Clicar no botão de download em massa
3. Aguardar download

#### Validações
- [ ] Arquivo ZIP é gerado
- [ ] Todas as fotos estão no ZIP
- [ ] Nomenclatura preservada no ZIP
- [ ] Estrutura organizada (se houver pastas por instalação)

#### Critério de Sucesso
Download completo com todas as fotos no formato esperado.

---

## 🔍 Checklist Final

Antes de considerar a funcionalidade completa, validar:

### Upload e Sincronização
- [ ] Upload individual sincroniza automaticamente
- [ ] Upload múltiplo sincroniza todas as fotos
- [ ] Importação Excel sincroniza fotos existentes
- [ ] Sincronização não bloqueia operações principais
- [ ] Falha de sync não quebra upload/importação

### Nomenclatura
- [ ] Nomenclatura padronizada: `peca_[codigo]_[data]_[seq].jpg`
- [ ] Nomenclatura geral: `arquivo_[data]_[seq].jpg`
- [ ] Sequencial correto mesmo com uploads simultâneos
- [ ] Data no formato AAAAMMDD

### Interface
- [ ] Badges aparecem apenas em fotos de instalações
- [ ] Badges "Geral" em fotos sem instalação
- [ ] Estatísticas atualizadas em tempo real
- [ ] Cards de estatísticas exibem valores corretos
- [ ] Tooltips mostram informações completas
- [ ] Performance não degrada com muitas fotos

### Galeria
- [ ] Fotos organizadas corretamente
- [ ] Filtros funcionam
- [ ] Busca funciona
- [ ] Ordenação funciona
- [ ] Download em massa funciona
- [ ] Edição funciona

### Performance
- [ ] Upload < 10s para 1 foto (4G)
- [ ] Upload < 30s para 10 fotos (4G)
- [ ] UI não trava durante uploads
- [ ] Galeria carrega rápido mesmo com 50+ fotos
- [ ] Estatísticas calculadas eficientemente (useMemo)

### Logs e Debug
- [ ] Logs com emojis facilitam identificação
- [ ] Console mostra erros de sync claramente
- [ ] Toast informa usuário sobre status de upload
- [ ] Informações detalhadas disponíveis no console

---

## 🐛 Cenários de Erro

### Teste de Falha de Rede
1. Desconectar internet durante upload
2. **Esperado:** Toast de erro, possibilidade de retry

### Teste de Arquivo Inválido
1. Tentar upload de arquivo não-imagem
2. **Esperado:** Toast informando tipo inválido, upload bloqueado

### Teste de Limite de Tamanho
1. Tentar upload de arquivo muito grande (>10MB)
2. **Esperado:** Upload funciona mas pode demorar, ou aviso de tamanho

### Teste de Duplicação
1. Fazer upload da mesma foto duas vezes
2. **Esperado:** Ambas salvas com sequenciais diferentes (001, 002)

---

## 📊 Métricas de Sucesso

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Taxa de sucesso de upload | >95% | (uploads sucesso / total uploads) × 100 |
| Tempo médio de upload (1 foto) | <10s | Cronômetro do início ao toast de sucesso |
| Tempo médio de upload (10 fotos) | <30s | Cronômetro do início ao último toast |
| Sincronização automática | 100% | Verificar fotos na galeria após upload |
| Precisão de estatísticas | 100% | Comparar contagem manual vs. cards |
| Performance da galeria | <2s | Tempo de carregamento inicial |

---

## 🚀 Notas para Desenvolvimento

- **Não fazer upload duplicado:** Verificar `storagePath` existente antes de novo upload
- **Sincronização não-bloqueante:** Usar try/catch isolado para não afetar fluxo principal
- **Performance:** useMemo para estatísticas evita recalculos desnecessários
- **Logs informativos:** Emojis facilitam identificação rápida no console
- **Buscar código da peça:** Usar `storage.getInstallation()` para informações completas

---

## ✅ Aprovação

**Testado por:** ___________________________  
**Data:** ____/____/______  
**Versão:** _______________  
**Status:** ⬜ Aprovado  ⬜ Aprovado com ressalvas  ⬜ Reprovado

**Observações:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

**Última atualização:** 2025-10-10  
**Versão do documento:** 1.0
