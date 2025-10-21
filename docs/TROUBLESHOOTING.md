# 🔧 Guia de Resolução de Problemas - DEA Field Manager

Soluções para problemas comuns que você pode encontrar ao usar o DEA Field Manager.

## 📑 Índice

- [Erro ao Importar Excel](#erro-ao-importar-excel)
- [Fotos Não Aparecem](#fotos-não-aparecem)
- [Relatório Não Gera](#relatório-não-gera)
- [Sincronização Falha](#sincronização-falha)
- [Sistema Lento](#sistema-lento)
- [Erros de Login](#erros-de-login)
- [Problemas de Rede](#problemas-de-rede)

---

## Erro ao Importar Excel

### 🔴 Sintomas
- Mensagem de erro ao tentar importar planilha
- Importação não completa
- Dados importados incorretamente

### 📋 Causa 1: Formato Incorreto

**Sintoma específico:** "Formato de arquivo não suportado"

**Solução:**
1. ✅ Salve a planilha como `.xlsx` (Excel 2007+) ou `.xls` (Excel 97-2003)
2. ❌ Não use CSV, Google Sheets direto, ou Numbers

**Passo a passo no Excel:**
```
Arquivo → Salvar Como → Escolha "Pasta de Trabalho do Excel (.xlsx)"
```

**Passo a passo no Google Sheets:**
```
Arquivo → Fazer download → Microsoft Excel (.xlsx)
```

---

### 📋 Causa 2: Colunas Faltando

**Sintoma específico:** "Coluna obrigatória não encontrada: tipologia"

**Colunas obrigatórias:**
- `tipologia`
- `codigo`
- `descricao`
- `quantidade`

**Solução:**

1. Abra sua planilha
2. Verifique a **primeira linha** (cabeçalhos)
3. Certifique-se de ter **exatamente** estes nomes (cuidado com espaços extras)

**❌ Incorreto:**
```
Tipologia  | Código  | Descrição  | Qtd
```

**✅ Correto:**
```
tipologia  | codigo  | descricao  | quantidade
```

**Dica:** Copie e cole os nomes corretos diretamente deste guia.

---

### 📋 Causa 3: Dados Inválidos

**Sintoma específico:** "Linha 5: Código deve ser um número positivo"

**Tipos de dados esperados:**

| Coluna | Tipo | Exemplo Correto | Exemplo Incorreto |
|--------|------|-----------------|-------------------|
| `tipologia` | Texto | "Porta Corta-Fogo" | (vazio) |
| `codigo` | Número | 101 | "P-101" ou "A" |
| `descricao` | Texto | "PCF 90min 2,10x0,90" | (vazio) |
| `quantidade` | Número | 2 | "duas" ou 0 |
| `diretriz_altura_cm` | Número | 210 | "2,10m" |

**Solução:**

1. **Identifique a linha** com erro (mensagem diz qual)
2. **Corrija o dado** conforme a tabela acima
3. **Remova formatação especial** (moeda, porcentagem, etc.)
4. **Tente importar novamente**

**Como converter texto para número no Excel:**
```
1. Selecione as células
2. Formatar Células (Ctrl+1)
3. Categoria: Número
4. Clique OK
```

---

### 📋 Causa 4: Codificação de Caracteres

**Sintoma específico:** Acentos aparecem como "?" ou caracteres estranhos

**Solução:**

1. Abra a planilha no Excel
2. Salve como `.xlsx` (não CSV)
3. Se persistir, salve como "Excel 97-2003 (.xls)"

**No Google Sheets:**
- Sempre baixe como `.xlsx`, não CSV

---

### 📋 Causa 5: Arquivo Muito Grande

**Sintoma específico:** "Timeout" ou importação trava

**Solução:**

1. **Divida a importação:**
   - Em vez de 500 linhas, importe 100 de cada vez
   - Crie múltiplos arquivos menores

2. **Remova colunas desnecessárias:**
   - Mantenha apenas as obrigatórias + opcionais que precisa

3. **Remova linhas vazias:**
   - Delete linhas completamente vazias no final

**Limite recomendado:** 200-300 instalações por importação

---

### ✅ Checklist de Verificação Antes de Importar

Antes de importar, verifique:

- [ ] Arquivo está em formato `.xlsx` ou `.xls`
- [ ] Primeira linha contém os nomes corretos das colunas
- [ ] Coluna `codigo` contém apenas números
- [ ] Coluna `quantidade` contém apenas números > 0
- [ ] Colunas `tipologia` e `descricao` estão preenchidas
- [ ] Não há linhas completamente vazias no meio
- [ ] Tamanho do arquivo < 5MB
- [ ] Menos de 300 linhas

---

## Fotos Não Aparecem

### 🔴 Sintomas
- Fotos não carregam
- Área de fotos aparece em branco
- Spinner de carregamento infinito

### 📋 Causa 1: Cache do Navegador

**Sintoma específico:** Fotos antigas aparecem, novas não

**Solução:**

**Opção 1 - Recarregar forçado:**
```
Windows/Linux: Ctrl+F5 ou Ctrl+Shift+R
Mac: Cmd+Shift+R
```

**Opção 2 - Limpar cache:**

**Chrome:**
1. `Ctrl+Shift+Del`
2. Selecione "Imagens e arquivos em cache"
3. Período: "Última hora"
4. Clique "Limpar dados"

**Firefox:**
1. `Ctrl+Shift+Del`
2. Selecione "Cache"
3. Clique "Limpar agora"

**Safari:**
1. Safari → Preferências → Avançado
2. Marque "Mostrar menu Desenvolver"
3. Desenvolver → Limpar caches

---

### 📋 Causa 2: Sincronização Pendente

**Sintoma específico:** Fotos adicionadas offline não aparecem

**Solução:**

1. **Verifique indicador de sincronização:**
   - 🟢 Verde = Sincronizado (fotos devem aparecer)
   - 🟡 Amarelo = Sincronizando (aguarde)
   - 🔴 Vermelho = Erro (veja seção [Sincronização Falha](#sincronização-falha))
   - ⚫ Cinza = Offline (aguarde conexão)

2. **Force sincronização manual:**
   - Clique no botão "🔄 Sincronizar" na barra superior
   - Aguarde até ficar verde

3. **Verifique se upload completou:**
   - Se adicionou fotos, aguarde a barra de progresso completar 100%
   - Não feche a página antes do upload terminar

---

### 📋 Causa 3: Permissões

**Sintoma específico:** Erro "Acesso negado" ao tentar carregar foto

**Solução:**

1. **Verifique se você tem permissão:**
   - Usuários "Visualizador" não veem todas as fotos
   - Contate o Admin do projeto

2. **Foto pode ter sido excluída:**
   - Verifique se foto ainda existe
   - Verifique histórico de revisões

3. **Problemas de autenticação:**
   - Faça logout e login novamente
   - Limpe cookies do navegador

---

### 📋 Causa 4: Upload Incompleto

**Sintoma específico:** Foto aparece quebrada (ícone de imagem quebrada 🖼️❌)

**Solução:**

1. **Re-faça upload da foto:**
   - Exclua a foto quebrada
   - Adicione novamente

2. **Verifique conexão durante upload:**
   - Internet pode ter caído no meio
   - Evite adicionar muitas fotos de uma vez se conexão instável

3. **Tamanho da foto:**
   - Limite: 10MB por foto
   - Sistema comprime automaticamente, mas se foto for muito grande pode dar erro
   - Recomendação: fotos com 2-5MB já são boas

---

### 📋 Causa 5: Bloqueio de Conteúdo

**Sintoma específico:** Nenhuma foto carrega, mas textos sim

**Solução:**

1. **Desative bloqueadores de anúncio:**
   - AdBlock, uBlock Origin podem bloquear imagens
   - Adicione DEA Field Manager à lista de exceções

2. **Verifique extensões do navegador:**
   - Desative temporariamente todas extensões
   - Reative uma por uma para identificar a problemática

3. **Firewall/Antivírus:**
   - Alguns programas bloqueiam carregamento de imagens de certos domínios
   - Adicione `supabase.co` à lista de sites confiáveis

---

### ✅ Checklist de Diagnóstico - Fotos

Execute na ordem:

1. [ ] Aguardou pelo menos 10 segundos de carregamento
2. [ ] Recarregou a página (Ctrl+F5)
3. [ ] Está conectado à internet
4. [ ] Sincronização está verde (🟢)
5. [ ] Limpou cache do navegador
6. [ ] Desativou extensões/bloqueadores
7. [ ] Tentou em navegador diferente
8. [ ] Tentou em outro dispositivo

Se tudo falhare: **Entre em contato com o suporte** com prints da tela.

---

## Relatório Não Gera

### 🔴 Sintomas
- Clica em "Gerar Relatório" mas nada acontece
- Spinner de carregamento infinito
- Erro "Falha ao gerar relatório"

### 📋 Causa 1: Sem Instalações

**Sintoma específico:** Projeto vazio ou sem instalações ativas

**Solução:**

1. **Adicione pelo menos uma instalação:**
   - Crie manualmente
   - Ou importe planilha Excel

2. **Verifique filtros:**
   - Pode haver instalações, mas filtros estão ocultando
   - Resete filtros para "Todas"

---

### 📋 Causa 2: Formato Inválido

**Sintoma específico:** Erro ao gerar PDF ou Excel

**Solução:**

1. **Tente outro formato:**
   - Se PDF falha, tente Excel
   - Se Excel falha, tente PDF

2. **Desmarque opção "Incluir Fotos":**
   - Fotos grandes podem causar timeout
   - Gere sem fotos primeiro para teste

3. **Reduza seções incluídas:**
   - Desmarque seções desnecessárias
   - Gere relatório simplificado

---

### 📋 Causa 3: Erro no Navegador

**Sintoma específico:** "Out of memory" ou página trava

**Solução:**

1. **Feche outras abas e programas:**
   - Libere memória RAM
   - Feche abas não utilizadas

2. **Tente navegador diferente:**
   - Chrome geralmente tem melhor performance
   - Se usa Firefox/Safari, tente Chrome

3. **Atualize o navegador:**
   - Versões antigas têm limitações de memória
   - Atualize para versão mais recente

4. **Reinicie o navegador:**
   - Feche completamente
   - Abra novamente
   - Tente gerar relatório

---

### 📋 Causa 4: Muitas Fotos Grandes

**Sintoma específico:** Relatório trava em "Processando fotos..."

**Solução:**

1. **Gere sem fotos:**
   - Desmarque "Incluir galeria de fotos"
   - Anexe fotos separadamente se necessário

2. **Gere em partes:**
   - Use filtros para gerar relatórios parciais
   - Ex: Relatório por pavimento

3. **Comprima fotos antes:**
   - Sistema comprime automaticamente
   - Mas se fotos originais são muito grandes (>10MB), delete e adicione versões menores

---

### 📋 Causa 5: Bloqueio de Downloads

**Sintoma específico:** Relatório gera, mas download não inicia

**Solução:**

1. **Permita downloads no navegador:**
   
   **Chrome:**
   - Ícone de download pode aparecer na barra de endereços (bloqueado)
   - Clique e selecione "Sempre permitir downloads deste site"

   **Firefox:**
   - Configurações → Privacidade → Permissões → Bloqueio de pop-ups
   - Adicione exceção para o site

2. **Desabilite bloqueadores de pop-up:**
   - Temporariamente desative
   - Ou adicione exceção para DEA Field Manager

3. **Verifique pasta de downloads:**
   - Pode ter baixado mas não notificou
   - Verifique pasta padrão de downloads

---

### ✅ Checklist - Relatório

Antes de reportar problema:

- [ ] Projeto tem pelo menos 1 instalação
- [ ] Tentou sem incluir fotos
- [ ] Fechou abas não utilizadas
- [ ] Tentou formato diferente (PDF → Excel ou vice-versa)
- [ ] Navegador está atualizado
- [ ] Permitiu downloads no navegador
- [ ] Desativou bloqueadores de pop-up

---

## Sincronização Falha

### 🔴 Sintomas
- Indicador de sincronização fica vermelho 🔴
- Mensagem "Erro ao sincronizar"
- Dados não aparecem em outros dispositivos

### 📋 Causa 1: Sem Internet

**Sintoma específico:** Indicador cinza ⚫ ou "Você está offline"

**Solução:**

1. **Verifique conexão:**
   - Abra outro site para testar
   - Verifique WiFi ou dados móveis
   - Reconecte se necessário

2. **Aguarde reconexão:**
   - Sistema detecta automaticamente quando volta online
   - Sincronização inicia sozinha

3. **Force sincronização após reconectar:**
   - Clique no botão "🔄 Sincronizar"

---

### 📋 Causa 2: Timeout

**Sintoma específico:** "Tempo limite excedido" ou "Timeout"

**Solução:**

1. **Conexão lenta:**
   - Verifique velocidade da internet
   - Evite sincronizar com 3G/2G se possível
   - Use WiFi quando disponível

2. **Muitos dados para sincronizar:**
   - Aguarde alguns minutos
   - Tente novamente
   - Se tem muitas fotos, sincronização pode demorar

3. **Divida a sincronização:**
   - Sincronize um projeto por vez
   - Feche outros projetos abertos

---

### 📋 Causa 3: Conflitos de Dados

**Sintoma específico:** "Conflito detectado" ou dados inconsistentes

**Solução:**

1. **Resolva conflitos pendentes:**
   - Modal de conflito deve aparecer
   - Escolha qual versão manter (local ou remota)
   - Confirme a escolha

2. **Se modal não aparece:**
   - Recarregue a página (F5)
   - Sistema deve detectar e mostrar conflitos

3. **Resolução automática (Last Write Wins):**
   - Se configurado, sistema resolve automaticamente
   - Versão mais recente é mantida
   - Você é notificado da decisão

📘 Veja mais: [FAQ - Resolver Conflitos](./FAQ.md#como-funciona-a-sincronização)

---

### 📋 Causa 4: Problemas de Autenticação

**Sintoma específico:** "Não autorizado" ou "Token expirado"

**Solução:**

1. **Faça logout e login novamente:**
   - Clique em seu perfil
   - Selecione "Sair"
   - Faça login novamente

2. **Limpe dados de autenticação:**
   - Limpe cookies do navegador
   - Faça login novamente

3. **Verifique sessão:**
   - Se ficou muito tempo inativo, sessão expira
   - Recarregue página e faça login

---

### 📋 Causa 5: Servidor Indisponível

**Sintoma específico:** "Erro 500" ou "Serviço temporariamente indisponível"

**Solução:**

1. **Aguarde alguns minutos:**
   - Pode ser manutenção temporária
   - Sistema geralmente volta sozinho

2. **Verifique status do serviço:**
   - (Link para página de status, se houver)
   - Redes sociais da empresa

3. **Continue trabalhando offline:**
   - Suas alterações ficam salvas localmente
   - Sincronizam automaticamente quando servidor voltar

---

### ✅ Checklist - Sincronização

Diagnóstico rápido:

- [ ] Está conectado à internet (teste abrindo outro site)
- [ ] Fez login recentemente (não ficou dias inativo)
- [ ] Não há conflitos pendentes de resolução
- [ ] Navegador está atualizado
- [ ] Tentou fazer logout/login
- [ ] Aguardou pelo menos 2-3 minutos

---

## Sistema Lento

### 🔴 Sintomas
- Páginas demoram para carregar
- Cliques não respondem imediatamente
- Scroll travado ou com lag
- Interface congela

### 📋 Causa 1: Muitas Fotos

**Sintoma específico:** Galeria de fotos trava ao rolar

**Solução:**

1. **Use lazy loading (já ativo):**
   - Sistema carrega fotos apenas quando visíveis
   - Aguarde scroll parar para fotos carregarem

2. **Limite fotos exibidas:**
   - Use filtros para mostrar menos instalações
   - Visualize por pavimento ou status

3. **Evite projetos com centenas de fotos na galeria:**
   - Divida em instalações menores
   - Recomendação: máx 50 fotos por instalação

---

### 📋 Causa 2: Cache Cheio

**Sintoma específico:** Sistema estava rápido, agora está lento

**Solução:**

**Limpe cache do navegador:**

```
Chrome/Edge: Ctrl+Shift+Del → "Imagens e arquivos em cache" → "Limpar"
Firefox: Ctrl+Shift+Del → "Cache" → "Limpar agora"
Safari: Desenvolver → Limpar caches
```

**Limpe dados do aplicativo:**

1. Navegador → Configurações
2. Privacidade e Segurança
3. Dados do site
4. Procure por DEA Field Manager
5. "Limpar dados" (⚠️ vai fazer logout)

---

### 📋 Causa 3: Navegador Desatualizado

**Sintoma específico:** Performance pobre em geral

**Solução:**

1. **Verifique versão do navegador:**
   - Chrome: Menu → Ajuda → Sobre o Google Chrome
   - Firefox: Menu → Ajuda → Sobre o Firefox
   - Edge: Menu → Ajuda e comentários → Sobre o Microsoft Edge

2. **Atualize se necessário:**
   - Navegadores geralmente atualizam automaticamente
   - Se não, baixe versão mais recente do site oficial

3. **Requisitos mínimos:**
   - Chrome 90+
   - Firefox 88+
   - Safari 14+
   - Edge 90+

---

### 📋 Causa 4: Muitas Abas/Processos

**Sintoma específico:** Computador inteiro está lento

**Solução:**

1. **Feche abas não utilizadas:**
   - Deixe apenas DEA Field Manager aberto
   - Feche outros sites e aplicativos

2. **Verifique uso de memória:**
   
   **Windows:**
   - `Ctrl+Shift+Esc` → Gerenciador de Tarefas
   - Veja uso de memória/CPU
   - Feche processos desnecessários

   **Mac:**
   - `Cmd+Space` → "Monitor de Atividade"
   - Veja uso de recursos
   - Feche apps desnecessários

3. **Reinicie o navegador:**
   - Salve tudo
   - Feche completamente o navegador
   - Abra novamente

---

### 📋 Causa 5: Extensões do Navegador

**Sintoma específico:** Lentidão apenas no DEA Field Manager

**Solução:**

1. **Desative extensões:**
   - Chrome: Menu → Mais ferramentas → Extensões
   - Desative todas temporariamente
   - Teste performance

2. **Reative uma por uma:**
   - Identifique qual extensão causa lentidão
   - Mantenha desativada ou desinstale

3. **Extensões conhecidas por causar problemas:**
   - Alguns bloqueadores de anúncios agressivos
   - Extensões de VPN
   - Ferramentas de desenvolvedor

---

### 📋 Causa 6: Hardware Limitado

**Sintoma específico:** Sistema sempre lento, mesmo com otimizações

**Solução:**

1. **Use dispositivo mais potente:**
   - Computador com pelo menos 4GB RAM
   - Celular/tablet recente (2-3 anos)

2. **Otimizações para hardware limitado:**
   - Não inclua fotos em relatórios
   - Trabalhe com poucos projetos abertos
   - Use modo de economia de dados (configurações)

3. **Alternativas:**
   - Use versão desktop em vez de mobile
   - Acesse de computador em vez de celular para tarefas pesadas

---

### ✅ Checklist - Performance

Para melhorar performance:

- [ ] Limpou cache do navegador
- [ ] Fechou abas não utilizadas
- [ ] Navegador está atualizado
- [ ] Desativou extensões problemáticas
- [ ] Limitou fotos por instalação (< 50)
- [ ] Não está com 10+ projetos abertos
- [ ] Computador tem pelo menos 4GB RAM

---

## Erros de Login

### 🔴 Sintomas
- Não consegue fazer login
- "Usuário ou senha incorretos"
- "Conta não encontrada"

### 📋 Causa 1: Senha Incorreta

**Solução:**

1. **Verifique Caps Lock:**
   - Senhas diferenciam maiúsculas de minúsculas
   - Caps Lock pode estar ativado

2. **Tente recuperar senha:**
   - Clique em "Esqueci minha senha"
   - Siga instruções no email

3. **Copie e cole senha (se salva):**
   - Evita erros de digitação

---

### 📋 Causa 2: Email Incorreto

**Solução:**

1. **Verifique email cadastrado:**
   - Pode ter usado email diferente
   - Tente variações (@gmail.com vs @outlook.com)

2. **Caso não lembre:**
   - Entre em contato com suporte
   - Informe nome completo para localização

---

### 📋 Causa 3: Conta Não Verificada

**Sintoma específico:** "Verifique seu email"

**Solução:**

1. **Procure email de verificação:**
   - Verifique caixa de entrada
   - Verifique spam/lixo eletrônico

2. **Reenvie email de verificação:**
   - Na tela de login, clique em "Reenviar verificação"
   - Digite seu email
   - Clique no link do novo email

3. **Email expirou:**
   - Links de verificação expiram em 24h
   - Solicite novo email

---

### 📋 Causa 4: Conta Bloqueada

**Sintoma específico:** "Conta temporariamente bloqueada"

**Solução:**

1. **Aguarde 30 minutos:**
   - Bloqueio automático após múltiplas tentativas falhas
   - Desbloqueio automático em 30min

2. **Entre em contato com suporte:**
   - Se bloqueio persistir
   - Se suspeitar de acesso não autorizado

---

## Problemas de Rede

### 📋 Conexão Intermitente

**Solução:**

1. **Use modo offline:**
   - Ative em Configurações → Sincronização
   - Evita tentativas contínuas de reconexão

2. **Trabalhe normalmente:**
   - Dados são salvos localmente
   - Sincronizam quando conexão estabilizar

---

### 📋 Upload Lento

**Solução:**

1. **Use WiFi em vez de dados móveis:**
   - Upload via 3G/4G é mais lento

2. **Adicione fotos em lotes menores:**
   - 5-10 fotos por vez em vez de 50+

3. **Aguarde horários de menos tráfego:**
   - Evite horários de pico

---

### 📋 Firewall/Proxy

**Sintoma:** "Conexão recusada" ou "Bloqueado"

**Solução:**

1. **Em redes corporativas:**
   - Contate TI para liberar acesso
   - Domínios a liberar:
     - `*.supabase.co`
     - `*.lovable.dev`

2. **Use rede diferente:**
   - Tente rede doméstica
   - Use dados móveis temporariamente

---

## 🆘 Ainda Precisa de Ajuda?

Se os problemas persistirem após seguir este guia:

1. **Reúna informações:**
   - Navegador e versão
   - Sistema operacional
   - Mensagem de erro exata
   - Prints de tela

2. **Entre em contato:**
   - Email: suporte@deafieldmanager.com
   - Descreva o problema detalhadamente
   - Anexe prints e informações coletadas

3. **Recursos adicionais:**
   - [Guia do Usuário](./USER_GUIDE.md)
   - [FAQ](./FAQ.md)
   - Documentação técnica

---

**Versão do Documento:** 1.0  
**Última Atualização:** Outubro 2025  
**Sistema:** DEA Field Manager v1.0
