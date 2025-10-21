# ❓ Perguntas Frequentes (FAQ) - DEA Field Manager

Respostas rápidas para as dúvidas mais comuns sobre o DEA Field Manager.

## 📑 Índice

- [Importação e Dados](#importação-e-dados)
- [Fotos e Arquivos](#fotos-e-arquivos)
- [Relatórios](#relatórios)
- [Sincronização](#sincronização)
- [Colaboração](#colaboração)
- [Conta e Acesso](#conta-e-acesso)
- [Técnico](#técnico)

---

## Importação e Dados

### Como importar uma planilha Excel?

1. Abra o projeto onde deseja importar
2. Clique no botão **"📊 Importar Excel"**
3. Selecione seu arquivo `.xlsx` ou `.xls`
4. Aguarde o processamento
5. Revise os resultados da importação

**Colunas obrigatórias na planilha:**
- `tipologia` (texto)
- `codigo` (número)
- `descricao` (texto)
- `quantidade` (número)

**Colunas opcionais:**
- `diretriz_altura_cm`
- `diretriz_dist_batente_cm`
- `pavimento`
- `observacoes`

📘 Veja mais detalhes em: [Guia do Usuário - Importar Excel](./USER_GUIDE.md#importar-planilha-excel)

---

### Minha planilha não importa. O que fazer?

Verifique se:

✅ **Formato do arquivo:** Deve ser `.xlsx` ou `.xls` (não CSV)  
✅ **Colunas obrigatórias:** Todas presentes e com nomes corretos  
✅ **Tipos de dados:** 
   - `codigo` e `quantidade` devem ser **números**
   - `tipologia` e `descricao` devem ser **texto**  
✅ **Linhas vazias:** Remova linhas completamente vazias  
✅ **Caracteres especiais:** Evite símbolos estranhos nos nomes das colunas

**Dica:** Baixe nossa [planilha modelo](../examples/template_instalacoes.xlsx) e use-a como referência.

---

### Posso importar fotos junto com a planilha?

Não diretamente. O processo é:

1. **Primeiro:** Importe a planilha com os dados das instalações
2. **Depois:** Adicione fotos manualmente a cada instalação

**Por que separado?**
- Garante que fotos sejam associadas corretamente
- Permite adicionar legendas
- Melhor controle de qualidade
- Compressão automática funciona melhor

---

### Como exporto meus dados?

**Opção 1: Relatório Excel**
1. Gere um relatório em formato Excel
2. Baixe o arquivo
3. Abra no Excel/Google Sheets

**Opção 2: Backup do Projeto**
1. Vá em **Configurações → Backup**
2. Clique em **"Exportar Dados do Projeto"**
3. Baixe o arquivo JSON (contém todos os dados)

⚠️ **Importante:** Não existe exportação em massa ainda. Exporte projeto por projeto.

---

### O que significa cada status de instalação?

| Status | Ícone | Significado |
|--------|-------|-------------|
| **Pendente** | ⏳ | Ainda não foi instalado |
| **Instalado** | ✅ | Instalação concluída e verificada |

**Status do Item (adicional):**
- **Ativo** 🟢: Instalação em andamento normal
- **On Hold** 🟡: Pausado temporariamente (falta material, aprovação, etc.)
- **Cancelado** 🔴: Não será mais executado
- **Pendente** ⚫: Aguardando início

---

### Como corrijo erro de importação?

**Se a importação falhou:**

1. **Leia a mensagem de erro** - ela indica qual linha e qual campo tem problema
2. **Corrija na planilha Excel**
3. **Importe novamente** - não vai duplicar, vai substituir

**Erros comuns e soluções:**

| Erro | Solução |
|------|---------|
| "Código deve ser número" | Remova letras/símbolos da coluna `codigo` |
| "Descrição é obrigatória" | Preencha células vazias na coluna `descricao` |
| "Quantidade deve ser positiva" | Use apenas números > 0 |
| "Coluna 'tipologia' não encontrada" | Verifique o nome exato da coluna (caixa-alta/baixa) |

---

## Fotos e Arquivos

### Posso usar o sistema offline?

**Sim!** O DEA Field Manager funciona completamente offline.

**Como usar:**
1. Abra o sistema enquanto estiver online (pelo menos uma vez)
2. Trabalhe normalmente sem internet:
   - Adicione fotos
   - Marque instalações
   - Edite dados
   - Adicione observações
3. Quando voltar online, tudo sincroniza automaticamente

**Limitações offline:**
- ❌ Não pode criar novos projetos
- ❌ Não pode convidar membros da equipe
- ❌ Não pode enviar relatórios por email
- ✅ Pode fazer tudo mais!

📘 Veja mais: [Guia do Usuário - Sincronização e Offline](./USER_GUIDE.md#sincronização-e-offline)

---

### Como adiciono fotos às instalações?

**Método Rápido:**
1. Clique no card da instalação
2. Clique em **"📷 Adicionar Foto"**
3. Selecione as fotos
4. Aguarde upload

**Método Detalhado:**
1. Clique no card para abrir detalhes
2. Role até seção "Fotos"
3. Clique em **"+ Adicionar Fotos"**
4. Arraste fotos ou clique para selecionar
5. Adicione legendas (opcional)
6. Clique em "Upload"

**Dicas:**
- 📱 Tire fotos direto no celular/tablet
- 🖼️ Formatos aceitos: JPG, PNG, WebP
- 📦 Tamanho máximo: 10MB por foto
- 🗜️ Sistema comprime automaticamente para ~2MB

---

### Onde ficam armazenadas minhas fotos?

**Armazenamento em nuvem segura:**
- Fotos são salvas no **Supabase Storage**
- Backup automático
- Acesso de qualquer dispositivo
- URLs únicas e seguras

**Armazenamento local (offline):**
- Cache no navegador para acesso offline
- Sincroniza com nuvem quando online
- Não ocupa espaço no celular (apenas cache temporário)

**Segurança:**
- ✅ Criptografado em trânsito (HTTPS)
- ✅ Acesso apenas para membros do projeto
- ✅ Backup redundante
- ✅ Exclusão permanente quando solicitado

---

### Fotos não aparecem. O que fazer?

Veja o guia completo em: [Troubleshooting - Fotos não aparecem](./TROUBLESHOOTING.md#fotos-não-aparecem)

**Verificações rápidas:**
1. ✅ Está conectado à internet?
2. ✅ Aguardou o carregamento completar?
3. ✅ Tentou recarregar a página (F5)?
4. ✅ Cache do navegador pode estar cheio (limpe em Configurações)

---

### Quantas fotos posso adicionar?

**Não há limite rígido**, mas recomendamos:

- 📸 **Máximo 50 fotos por instalação** para melhor performance
- 📂 **Máximo 500 fotos por projeto** para carregamento rápido

**Por que limitar?**
- Carregamento de páginas mais rápido
- Melhor experiência no celular
- Uso eficiente de armazenamento
- Geração de relatórios mais rápida

**Se precisar de mais fotos:**
- Organize em múltiplas instalações
- Use links externos para galerias grandes
- Entre em contato com suporte para aumentar limites

---

## Relatórios

### Como gero um relatório?

1. Abra o projeto
2. Clique em **"📊 Gerar Relatório"**
3. Escolha o tipo:
   - Cliente (executivo)
   - Fornecedor (técnico)
   - Completo (ambos)
4. Selecione seções a incluir
5. Escolha formato (PDF ou Excel)
6. Clique em **"Gerar"**

**Tempo de geração:**
- Pequeno (até 50 instalações): ~10 segundos
- Médio (50-200 instalações): ~30 segundos
- Grande (200+ instalações): ~1 minuto

📘 Detalhes completos: [Guia do Usuário - Gerando Relatórios](./USER_GUIDE.md#gerando-relatórios)

---

### Relatório não gera. O que fazer?

Veja o guia completo em: [Troubleshooting - Relatório não gera](./TROUBLESHOOTING.md#relatório-não-gera)

**Causas comuns:**

1. **Sem instalações no projeto**
   - Solução: Adicione pelo menos uma instalação

2. **Navegador bloqueando download**
   - Solução: Permita downloads do site

3. **Muitas fotos grandes**
   - Solução: Desmarque a opção "Incluir fotos" temporariamente

4. **Erro de memória no navegador**
   - Solução: Feche abas não utilizadas e tente novamente

---

### Posso personalizar o relatório?

**Sim!** Você pode:

✅ **Escolher seções:**
- Resumo executivo
- Estatísticas
- Lista de instalações
- Galeria de fotos
- Observações

✅ **Escolher formato:**
- PDF (para apresentação)
- Excel (para análise)

❌ **Não disponível (ainda):**
- Alterar cores e logo
- Adicionar seções personalizadas
- Modelos customizados

📬 Sugira novos recursos enviando feedback!

---

### Como compartilho relatório por email?

**Dentro do sistema:**

1. Após gerar relatório, clique em **"✉️ Enviar por Email"**
2. Digite email do destinatário
3. Adicione seu nome (opcional)
4. Clique em **"Enviar"**

**O destinatário recebe:**
- Email profissional com resumo
- Link seguro para download (válido 30 dias)
- Estatísticas do projeto

**Limitações:**
- 📧 Máximo **50 emails por dia** por usuário
- 🔒 Link expira em **30 dias**
- 📎 Email contém link, não anexo (para evitar bloqueios)

**Alternativa:** Baixe o PDF e envie manualmente via seu email.

---

## Sincronização

### O que fazer se a sincronização falhar?

Veja o guia completo em: [Troubleshooting - Sincronização falha](./TROUBLESHOOTING.md#sincronização-falha)

**Passos rápidos:**

1. ✅ Verifique sua conexão de internet
2. 🔄 Clique em "Sincronizar" novamente
3. ⏸️ Aguarde 1-2 minutos e tente novamente
4. 🔌 Se offline, aguarde voltar online
5. 🆘 Se persistir, recarregue a página (F5)

---

### Como funciona a sincronização?

**Automática:**
- 🕐 A cada **5 minutos** (configurável)
- 📡 Quando **volta online** após estar offline
- ✏️ Logo após **fazer alterações** importantes

**Manual:**
- Clique no botão **"🔄 Sincronizar"** na barra superior

**O que sincroniza:**
- Dados de instalações
- Fotos e arquivos
- Observações
- Marcações de "instalado"
- Edições de projetos

**Indicadores:**
- 🟢 Verde = Sincronizado
- 🟡 Amarelo = Sincronizando...
- 🔴 Vermelho = Erro
- ⚫ Cinza = Offline

---

### Quanto tempo leva para sincronizar?

Depende do volume de dados:

| Cenário | Tempo Estimado |
|---------|----------------|
| Apenas textos (10-50 instalações) | ~2-5 segundos |
| Com 10-20 fotos | ~10-20 segundos |
| Com 50+ fotos | ~30-60 segundos |
| Primeira sincronização (projeto novo) | ~1-3 minutos |

**Fatores que afetam:**
- 📶 Velocidade da internet
- 📷 Quantidade de fotos novas
- 💾 Tamanho das fotos (mesmo comprimidas)
- 🌐 Tráfego no servidor

---

## Colaboração

### Como convido membros da equipe?

1. Vá em **Configurações → Equipe**
2. Clique em **"+ Convidar Membro"**
3. Digite o **email** da pessoa
4. Escolha o **papel:**
   - Admin (controle total)
   - Editor (pode editar)
   - Visualizador (apenas leitura)
5. Clique em **"Enviar Convite"**

**A pessoa convidada:**
- Recebe email com link
- Cria conta (se não tiver)
- Acessa o projeto automaticamente

📘 Mais sobre permissões: [Guia do Usuário - Colaboração](./USER_GUIDE.md#colaboração)

---

### Quantas pessoas podem trabalhar juntas?

**Limite técnico:** Até **50 usuários simultâneos** por projeto

**Limite prático recomendado:**
- 👥 **5-10 usuários** trabalhando ativamente
- 👁️ **Sem limite** de visualizadores

**Por que limitar usuários ativos?**
- Evita conflitos de edição
- Melhor performance
- Sincronização mais confiável

---

### Como vejo quem está online?

**Indicadores de presença:**
- 👤 **Avatares** no canto superior direito
- 🟢 **Bolinha verde** = online agora
- ⚪ **Bolinha cinza** = offline

**Passe o mouse sobre o avatar** para ver:
- Nome completo
- Última atividade
- O que está editando (se aplicável)

---

## Conta e Acesso

### Como recupero minha senha?

1. Na tela de login, clique em **"Esqueci minha senha"**
2. Digite seu **email cadastrado**
3. Clique em **"Enviar link de recuperação"**
4. Verifique seu email
5. Clique no link recebido
6. Digite sua **nova senha**
7. Faça login com a nova senha

**Dicas:**
- 📧 Verifique pasta de spam
- ⏰ Link expira em 1 hora
- 🔒 Use senha forte (8+ caracteres, letras e números)

---

### Posso mudar meu email?

**Sim**, nas configurações:

1. Vá em **Perfil → Configurações da Conta**
2. Clique em **"Alterar Email"**
3. Digite novo email
4. Confirme com sua senha atual
5. Verifique email de confirmação no novo endereço
6. Clique no link para confirmar

⚠️ **Importante:** Após mudar email, use o novo para fazer login.

---

### Como excluo minha conta?

**Para excluir permanentemente:**

1. Vá em **Perfil → Configurações da Conta**
2. Role até o final da página
3. Clique em **"Excluir Conta"**
4. Confirme digitando sua senha
5. Confirme a exclusão

⚠️ **ATENÇÃO:**
- ❌ Ação irreversível
- 🗑️ Todos os seus dados serão excluídos permanentemente
- 📁 Projetos onde você é o único admin também serão excluídos
- 👥 Se há outros admins, projetos permanecem

**Alternativa:** Em vez de excluir, você pode apenas sair dos projetos.

---

## Técnico

### Quantos projetos posso criar?

**Plano Gratuito:** Até **10 projetos**  
**Plano Pro:** Até **100 projetos**  
**Plano Enterprise:** Ilimitado

**Dica:** Arquive projetos concluídos para liberar espaço na lista principal.

---

### O sistema funciona em celular/tablet?

**Sim!** O DEA Field Manager é totalmente responsivo.

**Funciona em:**
- 📱 **Smartphones** (iOS e Android)
- 📲 **Tablets** (iPad, Galaxy Tab, etc.)
- 💻 **Desktops** (Windows, Mac, Linux)

**Navegadores suportados:**
- ✅ Chrome (recomendado)
- ✅ Safari (iOS/Mac)
- ✅ Firefox
- ✅ Edge
- ⚠️ Internet Explorer (NÃO suportado)

**Recursos mobile:**
- 📸 Tirar foto direto da câmera
- 📍 GPS para localização (futuro)
- 📴 Modo offline completo
- 🔄 Sincronização automática

---

### Meu navegador é compatível?

**Requisitos mínimos:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Como verificar sua versão:**
1. Abra o navegador
2. Clique no menu (⋮ ou ≡)
3. Vá em "Ajuda" ou "Sobre"
4. Veja a versão

**Se estiver desatualizado:**
- Atualize para a versão mais recente
- Ou use outro navegador moderno

---

### Como limpo o cache?

**No Chrome/Edge:**
1. Pressione `Ctrl+Shift+Del` (ou `Cmd+Shift+Del` no Mac)
2. Selecione "Imagens e arquivos em cache"
3. Escolha período "Todo o período"
4. Clique em "Limpar dados"

**No Firefox:**
1. Pressione `Ctrl+Shift+Del`
2. Selecione "Cache"
3. Clique em "Limpar agora"

**No Safari:**
1. Safari → Preferências → Avançado
2. Marque "Mostrar menu Desenvolver"
3. Desenvolver → Limpar caches

**Depois de limpar:**
- Recarregue a página (F5)
- Faça login novamente se necessário

---

### Sistema está lento. O que fazer?

Veja o guia completo em: [Troubleshooting - Sistema lento](./TROUBLESHOOTING.md#sistema-lento)

**Quick fixes:**

1. 🗑️ **Limpe cache do navegador**
2. 🔄 **Recarregue a página** (Ctrl+F5)
3. 🚫 **Feche abas não utilizadas**
4. 📦 **Desative opção "Incluir fotos"** em relatórios grandes
5. 🆕 **Use navegador atualizado**

---

## Não encontrou sua dúvida?

- 📖 Consulte o [Guia do Usuário](./USER_GUIDE.md)
- 🔧 Veja o [Guia de Resolução de Problemas](./TROUBLESHOOTING.md)
- 💬 Entre em contato com o suporte

---

**Versão do Documento:** 1.0  
**Última Atualização:** Outubro 2025
