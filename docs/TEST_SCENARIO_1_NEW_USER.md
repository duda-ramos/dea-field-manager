# Cenário de Teste 1 - Primeiro Uso (Novo Usuário)

## 📋 Informações Gerais

**Objetivo:** Validar o fluxo completo de primeiro uso do sistema, desde a criação de conta até a geração do primeiro relatório.

**Tipo de Teste:** Manual / End-to-End

**Duração Estimada:**
- Usuário Técnico: < 5 minutos
- Usuário Leigo: < 10 minutos

**Pré-requisitos:**
- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Conexão com internet
- Email válido para cadastro
- Arquivo Excel de exemplo com dados de teste

---

## 🎯 Cenário Completo

### 1️⃣ Acessar o Sistema pela Primeira Vez

**Objetivo:** Verificar a tela inicial e opções de acesso.

#### Passos:
1. Abrir o navegador
2. Acessar a URL do sistema: `[URL_DO_SISTEMA]`
3. Aguardar carregamento completo da página

#### Verificações:
- [ ] Tela de login é exibida corretamente
- [ ] Logo da aplicação está visível
- [ ] Campos de email e senha estão presentes
- [ ] Botão "Entrar" está visível
- [ ] Link/botão "Criar conta" está visível e destacado
- [ ] Opção "Esqueci minha senha" está disponível (se aplicável)
- [ ] Layout responsivo (testar em diferentes resoluções)

#### Resultado Esperado:
✅ Interface de login clara e intuitiva, com destaque para a opção de criar nova conta.

#### ❌ Problemas Comuns:
- Tempo de carregamento > 3 segundos
- Elementos desalinhados
- Botões não responsivos

---

### 2️⃣ Criar Nova Conta

**Objetivo:** Validar o processo de registro de novo usuário.

#### Passos:
1. Clicar no botão/link "Criar conta"
2. Preencher o formulário com dados válidos:
   - **Nome completo:** João Silva
   - **Email:** joao.silva.teste@example.com
   - **Senha:** Teste@123456
   - **Confirmar senha:** Teste@123456
3. Aceitar termos de uso (se aplicável)
4. Clicar em "Criar conta" ou "Registrar"

#### Verificações de Validação:
- [ ] Nome: Mínimo 3 caracteres
- [ ] Email: Formato válido (usuario@dominio.com)
- [ ] Senha: 
  - Mínimo 8 caracteres
  - Letras maiúsculas e minúsculas
  - Números
  - Caracteres especiais
- [ ] Confirmação de senha: Deve ser igual à senha
- [ ] Mensagens de erro são claras e específicas
- [ ] Botão desabilitado enquanto campos inválidos

#### Testes de Validação (realizar separadamente):

**Teste 2.1 - Email inválido**
- Inserir: `emailinvalido`
- Resultado esperado: Mensagem "Email inválido"

**Teste 2.2 - Senha fraca**
- Inserir: `123456`
- Resultado esperado: Mensagem indicando requisitos de senha

**Teste 2.3 - Senhas não correspondem**
- Senha: `Teste@123456`
- Confirmar: `Teste@123`
- Resultado esperado: Mensagem "As senhas não correspondem"

**Teste 2.4 - Email já cadastrado**
- Usar email existente
- Resultado esperado: Mensagem "Email já cadastrado"

#### Confirmação de Email (se aplicável):
- [ ] Email de confirmação enviado
- [ ] Email recebido em < 2 minutos
- [ ] Link de confirmação funcional
- [ ] Redirecionamento correto após confirmação

#### Resultado Esperado:
✅ Conta criada com sucesso, mensagem de confirmação exibida, usuário pode fazer login.

#### ⏱️ Tempo Esperado:
- 1-2 minutos

---

### 3️⃣ Primeiro Login

**Objetivo:** Validar autenticação e estado inicial do sistema.

#### Passos:
1. Na tela de login, inserir:
   - **Email:** joao.silva.teste@example.com
   - **Senha:** Teste@123456
2. Clicar em "Entrar"
3. Aguardar autenticação

#### Verificações:
- [ ] Login processado em < 2 segundos
- [ ] Redirecionamento automático para Dashboard
- [ ] Nome do usuário exibido no header/menu
- [ ] Estado vazio do sistema:
  - [ ] Mensagem "Nenhum projeto criado"
  - [ ] Ilustração ou ícone de estado vazio
  - [ ] Botão CTA destacado: "+ Novo Projeto"
  - [ ] Texto explicativo sobre como começar
- [ ] Menu de navegação acessível
- [ ] Botão de logout visível

#### Resultado Esperado:
✅ Usuário autenticado com sucesso, Dashboard exibindo estado vazio de forma amigável.

#### ⏱️ Tempo Esperado:
- 30 segundos

---

### 4️⃣ Criar Primeiro Projeto

**Objetivo:** Validar criação de projeto e interface de configuração.

#### Passos:
1. Clicar no botão "+ Novo Projeto"
2. Preencher formulário de criação:
   - **Nome do Projeto:** Instalação Solar Residencial - Teste
   - **Cliente:** Empresa Teste LTDA
   - **Descrição:** Projeto de teste para validação do sistema
   - **Data de Início:** [Data atual]
   - **Localização:** São Paulo, SP (se aplicável)
3. Clicar em "Criar Projeto" ou "Salvar"

#### Verificações:
- [ ] Modal/página de criação abre corretamente
- [ ] Campos obrigatórios estão marcados com *
- [ ] Validações em tempo real:
  - [ ] Nome: Mínimo 3 caracteres
  - [ ] Cliente: Campo obrigatório
- [ ] Botão salvar desabilitado até campos válidos
- [ ] Opção de cancelar disponível
- [ ] Após criação:
  - [ ] Mensagem de sucesso exibida
  - [ ] Redirecionamento para página do projeto
  - [ ] Projeto aparece na lista de projetos
  - [ ] Estatísticas iniciais zeradas

#### Resultado Esperado:
✅ Projeto criado com sucesso, usuário direcionado para a página do projeto vazio.

#### ⏱️ Tempo Esperado:
- 1 minuto

---

### 5️⃣ Importar Planilha Excel

**Objetivo:** Validar funcionalidade de importação em lote.

#### Pré-requisito:
Criar arquivo Excel de teste com 15 instalações:

| ID | Cliente | Endereço | Cidade | UF | Status |
|----|---------|----------|--------|-----|--------|
| 1 | João Silva | Rua A, 100 | São Paulo | SP | Pendente |
| 2 | Maria Santos | Av. B, 200 | Campinas | SP | Pendente |
| ... | ... | ... | ... | ... | ... |
| 15 | Pedro Costa | Rua O, 1500 | Sorocaba | SP | Pendente |

#### Passos:
1. Na página do projeto, localizar botão "Importar Excel" ou similar
2. Verificar se há opção "Baixar Template"
3. Clicar em "Baixar Template" (se disponível)
4. Verificar estrutura do template baixado
5. Clicar em "Importar Excel" ou "Upload"
6. Selecionar arquivo de teste preparado
7. Aguardar processamento
8. Revisar preview de dados (se aplicável)
9. Confirmar importação

#### Verificações:
- [ ] Botão de download de template funcional
- [ ] Template contém cabeçalhos corretos
- [ ] Upload aceita formatos: .xlsx, .xls
- [ ] Barra de progresso durante upload
- [ ] Preview dos dados antes de confirmar
- [ ] Validação de campos obrigatórios
- [ ] Mensagens de erro claras para dados inválidos
- [ ] Após importação:
  - [ ] Mensagem "15 instalações importadas com sucesso"
  - [ ] Lista de instalações populada
  - [ ] Estatísticas atualizadas: 15 pendentes, 0 concluídas
  - [ ] Dados exibidos corretamente em tabela/cards

#### Testes de Erro:

**Teste 5.1 - Arquivo inválido**
- Upload de arquivo .pdf ou .doc
- Resultado esperado: Mensagem "Formato inválido. Use .xlsx ou .xls"

**Teste 5.2 - Planilha vazia**
- Upload de Excel sem dados
- Resultado esperado: Mensagem "Planilha vazia ou sem dados válidos"

**Teste 5.3 - Dados incompletos**
- Planilha com campos obrigatórios vazios
- Resultado esperado: Lista de erros por linha

#### Resultado Esperado:
✅ 15 instalações importadas com sucesso, dados exibidos corretamente, estatísticas atualizadas.

#### ⏱️ Tempo Esperado:
- 2-3 minutos

---

### 6️⃣ Adicionar Fotos

**Objetivo:** Validar upload de fotos e funcionalidades de galeria.

#### Preparar Arquivos de Teste:
- 9 imagens JPEG (3 fotos × 3 instalações)
- Tamanhos variados: 500KB, 2MB, 5MB
- Resoluções: 1920x1080, 3024x4032, 4000x3000

#### Passos:
1. Selecionar a **Instalação 1** da lista
2. Clicar em "Adicionar Fotos" ou ícone de câmera
3. Upload de 3 fotos:
   - Foto 1: Painel solar (2MB)
   - Foto 2: Instalação (5MB)
   - Foto 3: Medidor (500KB)
4. Aguardar processamento
5. Repetir para **Instalação 2** e **Instalação 3**

#### Verificações Durante Upload:
- [ ] Aceita formatos: .jpg, .jpeg, .png, .webp
- [ ] Upload múltiplo funcional (drag & drop ou seleção)
- [ ] Barra de progresso individual por foto
- [ ] Compressão automática aplicada:
  - [ ] Fotos > 2MB reduzidas
  - [ ] Qualidade preservada visualmente
  - [ ] Tamanho final < 1MB
- [ ] Preview imediato após upload
- [ ] Miniaturas geradas corretamente

#### Verificações Pós-Upload:
- [ ] Total de 9 fotos adicionadas (3 por instalação)
- [ ] Galeria exibe todas as fotos
- [ ] Miniaturas carregam rápido (< 1s)
- [ ] Clique na miniatura abre preview em tela cheia
- [ ] Navegação entre fotos funcional (setas)
- [ ] Opção de excluir foto disponível
- [ ] Nome/data da foto exibidos
- [ ] Contador de fotos atualizado

#### Funcionalidades da Galeria:
- [ ] Zoom in/out funcional
- [ ] Download de foto individual
- [ ] Rotação de imagem (se disponível)
- [ ] Legendas editáveis
- [ ] Fechar preview (ESC ou botão X)

#### Testes de Erro:

**Teste 6.1 - Arquivo muito grande**
- Upload de imagem > 10MB
- Resultado esperado: Mensagem de limite ou compressão automática

**Teste 6.2 - Formato inválido**
- Upload de .pdf ou .doc
- Resultado esperado: Mensagem "Formato inválido"

#### Resultado Esperado:
✅ 9 fotos adicionadas e comprimidas automaticamente, galeria funcional com preview e navegação.

#### ⏱️ Tempo Esperado:
- 2-3 minutos

---

### 7️⃣ Marcar como Instalado

**Objetivo:** Validar mudança de status e atualização de estatísticas.

#### Passos:
1. Selecionar 5 instalações da lista (IDs 1-5)
2. Marcar como "Concluído" ou "Instalado":
   - Opção A: Checkbox em cada item + ação em lote
   - Opção B: Botão individual em cada instalação
3. Para cada instalação, adicionar observações:
   - **Instalação 1:** "Instalação concluída sem intercorrências"
   - **Instalação 2:** "Cliente solicitou ajuste no posicionamento"
   - **Instalação 3:** "Teste de funcionamento OK"
   - **Instalação 4:** "Aguardando vistoria da concessionária"
   - **Instalação 5:** "Instalação finalizada, cliente satisfeito"
4. Salvar alterações

#### Verificações:
- [ ] Seleção múltipla funcional
- [ ] Campo de observações disponível
- [ ] Confirmação antes de alterar status
- [ ] Ação reversível (voltar para pendente)
- [ ] Após marcar como concluído:
  - [ ] Status visual atualizado (cor, ícone)
  - [ ] Estatísticas atualizadas em tempo real:
    - **Concluídas:** 5
    - **Pendentes:** 10
    - **Total:** 15
    - **Progresso:** 33%
  - [ ] Filtros funcionam corretamente
  - [ ] Observações salvas e visíveis
  - [ ] Data de conclusão registrada

#### Dashboard de Estatísticas:
- [ ] Gráfico/indicador de progresso atualizado
- [ ] Percentual de conclusão correto (33%)
- [ ] Cards com métricas atualizadas
- [ ] Histórico de alterações (se disponível)

#### Resultado Esperado:
✅ 5 instalações marcadas como concluídas, estatísticas atualizadas para 33% de conclusão, observações salvas.

#### ⏱️ Tempo Esperado:
- 2 minutos

---

### 8️⃣ Gerar Primeiro Relatório

**Objetivo:** Validar geração de relatório PDF com hyperlinks de fotos.

#### Passos:
1. Localizar botão "Gerar Relatório" ou similar
2. Clicar para abrir modal/wizard de relatórios
3. Configurar relatório:
   - **Tipo:** Relatório Executivo
   - **Destinatário:** Cliente
   - **Período:** [Data início até hoje]
   - **Incluir:**
     - [x] Estatísticas gerais
     - [x] Lista de instalações concluídas
     - [x] Fotos das instalações
     - [x] Observações
4. Clicar em "Gerar PDF" ou "Baixar Relatório"
5. Aguardar geração
6. Abrir arquivo PDF gerado

#### Verificações do Modal:
- [ ] Opções claras e intuitivas
- [ ] Preview de configurações
- [ ] Estimativa de páginas (se disponível)
- [ ] Opções de personalização:
  - [ ] Logo da empresa
  - [ ] Cores customizáveis
  - [ ] Campos adicionais

#### Verificações do PDF Gerado:

**Estrutura:**
- [ ] Capa com nome do projeto e cliente
- [ ] Índice/sumário (se aplicável)
- [ ] Seção de estatísticas:
  - [ ] Total de instalações: 15
  - [ ] Concluídas: 5 (33%)
  - [ ] Pendentes: 10 (67%)
  - [ ] Gráfico de progresso
- [ ] Lista de instalações concluídas (5 itens)
- [ ] Detalhes de cada instalação

**Fotos e Hyperlinks:**
- [ ] Miniaturas das fotos inseridas no PDF
- [ ] Hyperlinks clicáveis nas fotos
- [ ] Links direcionam para foto em alta resolução
- [ ] Fotos em alta qualidade carregam corretamente
- [ ] Layout organizado e profissional

**Observações:**
- [ ] Observações de cada instalação presentes
- [ ] Formatação clara e legível

**Qualidade Geral:**
- [ ] Texto sem erros ortográficos
- [ ] Alinhamento correto
- [ ] Imagens sem distorção
- [ ] Rodapé com data e página
- [ ] Arquivo < 5MB (compressão eficiente)

#### Testes Adicionais:

**Teste 8.1 - Hyperlinks**
- Clicar em 3 fotos diferentes no PDF
- Resultado esperado: Cada link abre foto correspondente em alta resolução

**Teste 8.2 - Compartilhamento**
- Enviar PDF por email
- Abrir em dispositivo diferente
- Resultado esperado: Links continuam funcionais

#### Resultado Esperado:
✅ Relatório PDF gerado com sucesso, contendo estatísticas atualizadas, fotos com hyperlinks funcionais, layout profissional.

#### ⏱️ Tempo Esperado:
- 2-3 minutos

---

## ✅ Critérios de Sucesso

### Funcionalidade
- [x] Todos os 8 passos completados sem erros críticos
- [x] Todas as funcionalidades principais funcionam conforme esperado
- [x] Dados persistem corretamente entre navegações

### Performance
- [x] Carregamento de páginas < 3 segundos
- [x] Upload de fotos < 5 segundos por imagem
- [x] Geração de PDF < 10 segundos

### Usabilidade
- [x] Usuário técnico completa em < 5 minutos
- [x] Usuário leigo completa em < 10 minutos
- [x] Menos de 3 cliques para ações principais
- [x] Mensagens de erro claras e acionáveis

### Qualidade
- [x] Zero erros de console JavaScript
- [x] Zero quebras de layout
- [x] Interface responsiva em todas as telas
- [x] Compressão de imagens funcional

---

## 📊 Métricas de Avaliação

| Critério | Meta | Resultado | Status |
|----------|------|-----------|--------|
| Tempo total (usuário técnico) | < 5 min | _____ min | ☐ |
| Tempo total (usuário leigo) | < 10 min | _____ min | ☐ |
| Erros encontrados | 0 críticos | _____ | ☐ |
| Taxa de sucesso | 100% | _____ % | ☐ |
| Satisfação do usuário | > 4/5 | _____ /5 | ☐ |

---

## 🐛 Registro de Problemas

### Problema 1
- **Passo:** _____
- **Descrição:** _____
- **Severidade:** ☐ Crítico ☐ Alto ☐ Médio ☐ Baixo
- **Screenshot:** _____
- **Console Errors:** _____

### Problema 2
- **Passo:** _____
- **Descrição:** _____
- **Severidade:** ☐ Crítico ☐ Alto ☐ Médio ☐ Baixo
- **Screenshot:** _____
- **Console Errors:** _____

---

## 📝 Observações Adicionais

### Pontos Positivos
- _____
- _____
- _____

### Pontos de Melhoria
- _____
- _____
- _____

### Sugestões
- _____
- _____
- _____

---

## ✍️ Assinatura do Teste

**Testador:** _____________________  
**Data:** ___/___/______  
**Versão do Sistema:** _____  
**Navegador:** _____  
**Status Final:** ☐ Aprovado ☐ Aprovado com ressalvas ☐ Reprovado

---

## 📎 Anexos

- [ ] Screenshots de cada passo
- [ ] Vídeo do fluxo completo
- [ ] Arquivo Excel de teste
- [ ] PDF gerado
- [ ] Logs de console (se houver erros)
