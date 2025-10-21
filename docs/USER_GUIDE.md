# 📖 Guia do Usuário - DEA Field Manager

Bem-vindo ao **DEA Field Manager**, sua solução completa para gerenciamento de instalações e projetos de campo.

## 📑 Índice

1. [Introdução ao DEA Field Manager](#introdução-ao-dea-field-manager)
2. [Primeiros Passos](#primeiros-passos)
3. [Gerenciamento de Projetos](#gerenciamento-de-projetos)
4. [Trabalhando com Instalações](#trabalhando-com-instalações)
5. [Gerando Relatórios](#gerando-relatórios)
6. [Sincronização e Offline](#sincronização-e-offline)
7. [Colaboração](#colaboração)
8. [Dicas e Melhores Práticas](#dicas-e-melhores-práticas)

---

## Introdução ao DEA Field Manager

O **DEA Field Manager** é uma aplicação web moderna projetada para facilitar o gerenciamento de instalações em projetos de campo. Com ele, você pode:

✅ **Gerenciar múltiplos projetos** simultaneamente  
✅ **Importar planilhas Excel** com dados de instalações  
✅ **Adicionar fotos e observações** em campo  
✅ **Gerar relatórios profissionais** para clientes e fornecedores  
✅ **Trabalhar offline** e sincronizar quando conectado  
✅ **Colaborar com equipe** em tempo real  

### Principais Recursos

- **Interface moderna e intuitiva**: Design responsivo que funciona em desktop, tablet e celular
- **Performance otimizada**: Carregamento rápido de imagens e dados
- **Compressão automática de imagens**: Reduz em 70-80% o tamanho das fotos
- **Modo offline**: Continue trabalhando sem internet
- **Sincronização inteligente**: Dados sincronizam automaticamente quando conectado
- **Histórico de revisões**: Acompanhe mudanças em instalações
- **Resolução de conflitos**: Sistema automático para evitar perda de dados

---

## Primeiros Passos

### Login e Registro

1. **Acessar o sistema**: Abra o DEA Field Manager no navegador
2. **Criar conta**:
   - Clique em "Criar conta"
   - Preencha nome, email e senha
   - Confirme o email (se solicitado)
3. **Fazer login**:
   - Digite seu email e senha
   - Clique em "Entrar"

### Visão Geral da Interface

Após fazer login, você verá:

```
┌─────────────────────────────────────────────────┐
│  [≡] DEA Field Manager          [🔔] [👤]      │  ← Barra superior
├─────────────────────────────────────────────────┤
│ [📁]  │  Dashboard / Projetos                   │
│ Proje │  ┌───────────────────────────────┐      │
│ tos   │  │  Estatísticas                 │      │
│       │  │  • Total: 5 projetos          │      │
│ [📊]  │  │  • Concluídos: 2              │      │
│ Dash  │  │  • Em andamento: 3            │      │
│ board │  └───────────────────────────────┘      │
│       │  [Lista de Projetos]                    │
│ [⚙️]  │                                          │
│ Config│                                          │
└───────┴──────────────────────────────────────────┘
```

**Elementos principais:**
- **Menu lateral** (≡): Navegação entre seções
- **Notificações** (🔔): Alertas e atualizações
- **Perfil** (👤): Suas configurações
- **Dashboard**: Estatísticas gerais
- **Área de trabalho**: Conteúdo principal

---

## Gerenciamento de Projetos

### Criar Novo Projeto

1. Na página **Projetos**, clique em **"+ Novo Projeto"**
2. Preencha as informações obrigatórias:
   - **Nome do Projeto** * (mín. 3 caracteres)
   - **Cliente** * (obrigatório)
   - **Cidade** (recomendado)
3. Informações opcionais:
   - **Código do Projeto**: Ex: P-2024-001
   - **Responsável**: Nome do gerente
   - **Link dos Arquivos**: URL para pasta compartilhada
   - **Fornecedores**: Adicione um ou mais fornecedores
4. Clique em **"Criar Projeto"**

**Dica:** Use códigos de projeto padronizados para facilitar a organização (ex: P-2024-001, P-2024-002, etc.)

### Importar Planilha Excel

A importação de planilhas Excel é uma das funcionalidades mais poderosas do sistema.

#### Preparar a Planilha

Sua planilha deve conter as seguintes colunas (respeitando exatamente estes nomes):

| Coluna Obrigatória | Tipo | Descrição | Exemplo |
|-------------------|------|-----------|---------|
| `tipologia` | Texto | Tipo da instalação | "Porta Corta-Fogo" |
| `codigo` | Número | Código único | 101 |
| `descricao` | Texto | Descrição detalhada | "Porta PCF 90min" |
| `quantidade` | Número | Quantidade | 2 |

**Colunas Opcionais:**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `diretriz_altura_cm` | Número | Altura em cm |
| `diretriz_dist_batente_cm` | Número | Distância do batente |
| `pavimento` | Texto | Andar/pavimento |
| `observacoes` | Texto | Observações gerais |

#### Exemplo de Planilha Válida

```excel
tipologia              | codigo | descricao           | quantidade | pavimento | observacoes
Porta Corta-Fogo      | 101    | PCF 90min 2,10x0,90| 2          | Térreo    | Próximo ao hall
Porta Corta-Fogo      | 102    | PCF 60min 2,10x0,80| 1          | 1º Andar  | -
Escada Enclausurada   | 201    | Escada tipo A      | 1          | Todos     | Verificar norma
```

#### Realizar a Importação

1. Abra o **projeto** onde deseja importar
2. Clique no botão **"Importar Excel"** (ícone 📊)
3. Selecione o arquivo `.xlsx` ou `.xls`
4. Aguarde o processamento
5. Revise os resultados:
   - ✅ Linhas importadas com sucesso
   - ⚠️ Avisos (dados opcionais faltando)
   - ❌ Erros (dados obrigatórios inválidos)

**O que acontece após importação:**
- Instalações são criadas automaticamente
- Status inicial é "Pendente"
- Você pode editá-las individualmente depois

### Navegar entre Seções

**Dentro de um Projeto**, você tem acesso às seguintes abas:

1. **📋 Instalações**: Lista todas as instalações do projeto
2. **🏠 Informações**: Dados gerais do projeto
3. **💰 Orçamento**: Controle financeiro e custos
4. **👥 Contatos**: Clientes, fornecedores e equipe da obra
5. **📁 Arquivos**: Documentos e anexos do projeto
6. **📊 Relatórios**: Histórico de relatórios gerados

**Navegação rápida:**
- Use o **menu lateral** para alternar entre projetos
- Use as **abas superiores** para alternar seções dentro do projeto
- Use o botão **"← Voltar"** para retornar à lista de projetos

---

## Trabalhando com Instalações

### Visualizar Lista de Instalações

Na aba **Instalações**, você verá:

- **Barra de busca**: Pesquise por código, descrição ou pavimento
- **Filtros**:
  - Por status: Todas / Instaladas / Pendentes
  - Por pavimento: Térreo, 1º Andar, etc.
  - Por status do item: Ativo / On Hold / Cancelado / Pendente
- **Lista de instalações**: Cards com informações resumidas

**Informações exibidas em cada card:**
- Código e Tipologia
- Descrição
- Status de instalação (Instalado ✓ / Pendente)
- Status do item (badge colorido)
- Pavimento
- Quantidade de fotos (📷)
- Observações (se houver)

### Marcar como Instalado

Para marcar uma instalação como concluída:

1. Localize a instalação na lista
2. Clique no **checkbox** ao lado do status
3. A instalação é marcada como **Instalado** ✅
4. Um toast de confirmação aparece
5. As estatísticas são atualizadas automaticamente

**Dica:** Você pode usar o atalho **Ctrl+Z** (Cmd+Z no Mac) para desfazer a ação imediatamente.

### Adicionar Fotos

O sistema possui compressão automática de imagens, economizando até 80% de espaço!

**Método 1: Adicionar fotos diretamente na lista**

1. Clique no card da instalação
2. Clique no ícone **📷 "Adicionar Foto"**
3. Selecione uma ou mais imagens
4. Aguarde o upload (com barra de progresso)
5. Fotos aparecem na galeria automaticamente

**Método 2: Adicionar fotos na visualização detalhada**

1. Clique no card da instalação para abrir o modal
2. Na seção **"Fotos"**, clique em **"+ Adicionar Fotos"**
3. Selecione ou arraste imagens
4. Adicione legendas (opcional)
5. Clique em **"Upload"**

**Formatos suportados:**
- JPG/JPEG
- PNG
- WebP
- Tamanho máximo: 10MB (será comprimido automaticamente para ~2MB)

**Recursos da galeria de fotos:**
- ✅ **Lazy loading**: Imagens carregam apenas quando visíveis
- ✅ **Zoom**: Clique para visualizar em tela cheia
- ✅ **Legendas**: Adicione descrições às fotos
- ✅ **Download**: Baixe fotos individualmente
- ✅ **Excluir**: Remova fotos indesejadas

### Adicionar Observações

Observações ajudam a documentar detalhes importantes:

1. Abra a instalação (clique no card)
2. Role até a seção **"Observações"**
3. Digite sua observação no campo de texto
4. Clique em **"Salvar"**

**Tipos de observações úteis:**
- ⚠️ Problemas encontrados
- ✅ Detalhes da instalação
- 📅 Prazos e datas importantes
- 🔧 Materiais ou ferramentas necessárias
- 📝 Instruções especiais

### Editar Instalação

Para modificar dados de uma instalação:

1. Abra a instalação (clique no card)
2. Clique no botão **"✏️ Editar"**
3. Modifique os campos desejados:
   - Descrição
   - Quantidade
   - Diretrizes (altura, distância)
   - Status do item
   - Pavimento
   - Observações
4. Clique em **"Salvar Alterações"**

**Sistema de Histórico:**
- Todas as edições são registradas
- Acesse o **histórico de revisões** para ver mudanças anteriores
- Restaure versões antigas se necessário

---

## Gerando Relatórios

O DEA Field Manager oferece relatórios profissionais personalizáveis.

### Tipos de Relatórios

1. **Relatório para Cliente**
   - Visão executiva do progresso
   - Fotos das instalações concluídas
   - Estatísticas de avanço
   - Layout profissional

2. **Relatório para Fornecedor**
   - Detalhes técnicos das instalações
   - Quantitativos
   - Especificações e diretrizes
   - Lista de pendências

3. **Relatório Completo**
   - Combinação de ambos os relatórios
   - Máximo de detalhes
   - Inclui todas as seções

### Personalizar Seções do Relatório

Antes de gerar, você pode personalizar:

1. Clique em **"📊 Gerar Relatório"**
2. Escolha o **tipo de relatório**
3. Selecione as **seções a incluir**:
   - ☑️ Resumo executivo
   - ☑️ Estatísticas detalhadas
   - ☑️ Lista de instalações
   - ☑️ Galeria de fotos
   - ☑️ Observações e pendências
   - ☑️ Dados do projeto
4. Escolha o **formato de saída**:
   - 📄 **PDF**: Para visualização e impressão
   - 📊 **Excel**: Para análise e edição
5. Clique em **"Gerar"**

### Baixar e Compartilhar

Após gerar o relatório:

**Opção 1: Download**
- Clique em **"⬇️ Baixar"**
- O arquivo é salvo no seu dispositivo
- Nome do arquivo: `Relatorio_[NomeProjeto]_[Data].pdf`

**Opção 2: Compartilhar por Email**
- Clique em **"✉️ Enviar por Email"**
- Digite o email do destinatário
- Adicione seu nome (opcional)
- Clique em **"Enviar"**
- Um link seguro é enviado (válido por 30 dias)

**Opção 3: Link Público**
- Clique em **"🔗 Copiar Link"**
- Link é copiado para a área de transferência
- Compartilhe via WhatsApp, Teams, etc.
- Link expira em 30 dias

### Histórico de Relatórios

Acesse relatórios gerados anteriormente:

1. Vá para a aba **"📊 Relatórios"**
2. Veja a lista de relatórios ordenados por data
3. Para cada relatório:
   - **Visualizar**: Abra o relatório novamente
   - **Baixar**: Faça download
   - **Reenviar**: Envie por email novamente
   - **Excluir**: Remova relatórios antigos

**Informações exibidas:**
- Data e hora de geração
- Tipo de relatório
- Formato (PDF/Excel)
- Quem gerou
- Quantidade de instalações incluídas

---

## Sincronização e Offline

O DEA Field Manager foi projetado para funcionar mesmo sem internet.

### Como Funciona a Sincronização

**Sincronização Automática:**
- Ativada por padrão
- Sincroniza a cada 5 minutos (configurável)
- Sincroniza quando você volta online
- Sincroniza quando você faz alterações

**Sincronização Manual:**
- Clique no botão **"🔄 Sincronizar"** na barra superior
- Útil quando você quer forçar uma atualização
- Indicador mostra progresso

**Indicadores de Status:**
- 🟢 **Verde**: Sincronizado
- 🟡 **Amarelo**: Sincronizando...
- 🔴 **Vermelho**: Erro na sincronização
- ⚫ **Cinza**: Offline (sem internet)

### Trabalhar Offline

Quando você está sem internet:

1. **Continue trabalhando normalmente**
   - Adicione fotos
   - Marque instalações
   - Edite dados
   - Adicione observações

2. **Dados ficam em fila**
   - Todas as alterações são salvas localmente
   - Ícone de "nuvem offline" aparece

3. **Sincronização automática ao reconectar**
   - Quando voltar online, sincronização inicia automaticamente
   - Toast de confirmação aparece
   - Dados são enviados ao servidor

**Dica:** Em áreas com conexão instável, ative o "Modo Offline" nas configurações para evitar tentativas contínuas de sincronização.

### Resolver Conflitos

Conflitos ocorrem quando:
- Você edita offline e outra pessoa edita online
- Duas pessoas editam o mesmo item simultaneamente

**Resolução Automática (Last Write Wins):**
- Sistema mantém a versão mais recente por padrão
- Você é notificado quando um conflito é resolvido
- Toast mostra qual versão foi mantida

**Resolução Manual:**
1. Quando há conflito, um modal aparece
2. Veja as **duas versões lado a lado**:
   - Versão Local (suas alterações)
   - Versão Remota (do servidor)
3. Escolha qual versão manter
4. Clique em **"Manter Esta Versão"**

**Para evitar conflitos:**
- Sincronize antes de trabalhar offline por muito tempo
- Comunique-se com a equipe sobre quem está editando o quê
- Use o sistema de colaboração para ver quem está online

---

## Colaboração

Trabalhe em equipe de forma eficiente.

### Adicionar Membros da Equipe

1. Vá para **Configurações → Equipe**
2. Clique em **"+ Convidar Membro"**
3. Digite o **email** da pessoa
4. Escolha o **papel/permissão**:
   - **Admin**: Controle total
   - **Editor**: Pode editar dados
   - **Visualizador**: Apenas leitura
5. Clique em **"Enviar Convite"**
6. A pessoa recebe um email com link de acesso

### Permissões e Papéis

**👑 Admin (Administrador):**
- Criar e excluir projetos
- Convidar e remover membros
- Modificar configurações do projeto
- Gerar relatórios
- Editar todas as instalações
- Acesso total ao sistema

**✏️ Editor:**
- Editar instalações
- Adicionar fotos
- Marcar como instalado
- Gerar relatórios
- **Não pode:** Excluir projetos ou gerenciar equipe

**👁️ Visualizador:**
- Ver projetos e instalações
- Ver fotos e documentos
- Baixar relatórios
- **Não pode:** Editar dados ou adicionar fotos

### Presença em Tempo Real

Veja quem está trabalhando no projeto:

- **Avatares** aparecem no canto superior direito
- **Indicador verde** = Online agora
- **Hover** sobre avatar para ver nome
- **Notificações** quando alguém edita algo

---

## Dicas e Melhores Práticas

### 📸 Fotos

✅ **Faça:**
- Tire fotos bem iluminadas
- Capture diferentes ângulos
- Adicione legendas descritivas
- Organize por instalação

❌ **Evite:**
- Fotos muito grandes (sistema comprime, mas evite >10MB)
- Fotos desfocadas ou escuras
- Upload em lote muito grande (use grupos de 10-20 fotos)

### 📊 Projetos

✅ **Faça:**
- Use códigos padronizados (P-2024-001)
- Preencha todas as informações importantes
- Mantenha dados de contato atualizados
- Arquive projetos concluídos (não delete)

❌ **Evite:**
- Criar projetos duplicados
- Deixar campos importantes vazios
- Excluir projetos (prefira arquivar)

### 🔄 Sincronização

✅ **Faça:**
- Mantenha sincronização automática ativada
- Sincronize antes de trabalhar offline por muito tempo
- Verifique se sincronizou antes de gerar relatórios importantes

❌ **Evite:**
- Trabalhar offline por dias sem sincronizar
- Desativar sincronização automática sem motivo
- Ignorar avisos de conflito

### 📝 Organização

✅ **Faça:**
- Use filtros e busca para encontrar instalações
- Adicione observações relevantes
- Revise dados importados do Excel
- Use tags e pavimentos para organização

❌ **Evite:**
- Deixar observações vazias
- Ignorar erros de importação
- Misturar dados de diferentes projetos

### ⚡ Performance

✅ **Faça:**
- Limpe cache do navegador periodicamente
- Feche abas não utilizadas
- Use navegadores modernos (Chrome, Firefox, Edge)
- Mantenha o sistema atualizado

❌ **Evite:**
- Abrir 10+ projetos simultaneamente
- Upload de centenas de fotos de uma vez
- Usar navegadores desatualizados

---

## 🆘 Precisa de Ajuda?

- **FAQ**: Consulte as [Perguntas Frequentes](./FAQ.md)
- **Problemas**: Veja o [Guia de Resolução de Problemas](./TROUBLESHOOTING.md)
- **Suporte**: Entre em contato com nossa equipe

---

**Versão do Documento:** 1.0  
**Última Atualização:** Outubro 2025  
**Sistema:** DEA Field Manager v1.0
