# Checklist de Testes de Aceitação

Este documento contém o checklist completo para validação final de todas as funcionalidades do sistema antes do deploy em produção.

---

## 1. Autenticação e Usuários

### Login
- [ ] Login com credenciais válidas redireciona para dashboard
- [ ] Login com credenciais inválidas exibe mensagem de erro apropriada
- [ ] Mensagem de erro não revela se email existe no sistema (segurança)
- [ ] Campo de senha está mascarado por padrão
- [ ] Botão de "mostrar/ocultar senha" funciona corretamente
- [ ] Loading state é exibido durante autenticação
- [ ] Token de autenticação é armazenado corretamente
- [ ] Sessão expira após período de inatividade configurado

### Logout
- [ ] Logout limpa sessão e tokens armazenados
- [ ] Logout redireciona para página de login
- [ ] Dados sensíveis são removidos do localStorage/sessionStorage
- [ ] Estado da aplicação é resetado após logout

### Registro
- [ ] Formulário de registro valida todos os campos obrigatórios
- [ ] Email duplicado é rejeitado com mensagem apropriada
- [ ] Senha fraca é rejeitada com critérios claros (mínimo 8 caracteres, etc.)
- [ ] Confirmação de senha valida que ambas são iguais
- [ ] Após registro bem-sucedido, usuário é autenticado automaticamente
- [ ] Email de boas-vindas é enviado (se aplicável)
- [ ] Validação de formato de email funciona corretamente

### Recuperação de Senha
- [ ] Formulário de recuperação aceita email cadastrado
- [ ] Email com link de redefinição é enviado
- [ ] Link de redefinição expira após período configurado (ex: 1 hora)
- [ ] Link usado uma vez não pode ser reutilizado
- [ ] Nova senha pode ser definida através do link válido
- [ ] Após redefinição, usuário pode fazer login com nova senha
- [ ] Mensagem de sucesso é exibida após redefinição

### Perfil de Usuário
- [ ] Usuário pode visualizar seus dados de perfil
- [ ] Usuário pode editar nome e outras informações permitidas
- [ ] Email não pode ser alterado (ou requer verificação se permitido)
- [ ] Foto de perfil pode ser carregada e visualizada
- [ ] Alterações são salvas e persistidas corretamente
- [ ] Validações impedem dados inválidos
- [ ] Mensagem de sucesso é exibida após atualização

---

## 2. Projetos

### Criar Projeto
- [ ] Modal/formulário de criação abre corretamente
- [ ] Todos os campos obrigatórios são validados antes de salvar
- [ ] Nome do projeto é obrigatório e validado
- [ ] Cliente/empresa é obrigatório e validado
- [ ] Data de início é obrigatória e validada
- [ ] Projeto criado aparece na listagem imediatamente
- [ ] Mensagem de sucesso é exibida após criação
- [ ] Redirecionamento para detalhes do projeto (se aplicável)

### Editar Projeto
- [ ] Formulário de edição carrega dados atuais do projeto
- [ ] Alterações são salvas corretamente
- [ ] Campos obrigatórios continuam validados
- [ ] Nome do projeto pode ser alterado
- [ ] Data de conclusão pode ser adicionada/editada
- [ ] Mudanças são refletidas na listagem
- [ ] Histórico de alterações é mantido (se aplicável)

### Arquivar Projeto
- [ ] Opção de arquivar está disponível para projetos concluídos
- [ ] Modal de confirmação é exibido antes de arquivar
- [ ] Projeto arquivado não aparece na listagem padrão
- [ ] Projetos arquivados podem ser visualizados em filtro específico
- [ ] Projeto arquivado pode ser desarquivado
- [ ] Instalações do projeto arquivado permanecem acessíveis

### Importar Excel
- [ ] Botão de importação abre modal de upload
- [ ] Arquivo Excel (.xlsx, .xls) é aceito
- [ ] Template de exemplo está disponível para download
- [ ] Validação de formato do arquivo funciona
- [ ] Colunas obrigatórias são validadas antes da importação
- [ ] Preview dos dados a serem importados é exibido
- [ ] Erros de validação são listados com linhas específicas
- [ ] Importação processa até 600 instalações em menos de 60 segundos
- [ ] Progress bar mostra andamento da importação
- [ ] Instalações importadas aparecem na listagem
- [ ] Dados duplicados são identificados e tratados
- [ ] Rollback automático em caso de erro crítico

### Campos Obrigatórios
- [ ] Nome do projeto é obrigatório
- [ ] Cliente/empresa é obrigatório
- [ ] Data de início é obrigatória
- [ ] Validação ocorre no frontend antes do submit
- [ ] Validação ocorre no backend para segurança
- [ ] Mensagens de erro são claras e específicas por campo

### Validações
- [ ] Data de conclusão não pode ser anterior à data de início
- [ ] Nome do projeto tem limite de caracteres apropriado
- [ ] Caracteres especiais são tratados corretamente
- [ ] Validações são consistentes entre criação e edição

---

## 3. Instalações

### Listar Instalações
- [ ] Lista carrega todas as instalações do projeto
- [ ] Paginação funciona corretamente (se aplicável)
- [ ] Scroll infinito funciona suavemente (se aplicável)
- [ ] Performance é aceitável com 600+ instalações
- [ ] Colunas principais são exibidas: ID, Nome, Status, etc.
- [ ] Ordenação por colunas funciona corretamente
- [ ] Estado de instalado/não instalado é visível

### Filtrar Instalações
- [ ] Filtro por status (instalado/não instalado) funciona
- [ ] Filtro por tipo de instalação funciona
- [ ] Filtro por data funciona
- [ ] Múltiplos filtros podem ser combinados
- [ ] Filtros ativos são visíveis para o usuário
- [ ] Botão "limpar filtros" remove todos os filtros
- [ ] URL é atualizada com filtros aplicados (se aplicável)

### Buscar Instalações
- [ ] Campo de busca filtra em tempo real
- [ ] Busca funciona por ID da instalação
- [ ] Busca funciona por nome/descrição
- [ ] Busca funciona por endereço
- [ ] Busca é case-insensitive
- [ ] Performance da busca é aceitável com 600+ instalações
- [ ] Resultados são destacados/marcados

### Criar Instalação Manualmente
- [ ] Modal/formulário de criação abre corretamente
- [ ] Campos obrigatórios são validados
- [ ] InstallationId é gerado automaticamente (se aplicável)
- [ ] InstallationId pode ser inserido manualmente
- [ ] Campos de diretrizes X e Y aceitam valores numéricos
- [ ] Validação de formato dos campos numéricos
- [ ] Campo de observações aceita texto livre
- [ ] Instalação criada aparece na listagem
- [ ] Mensagem de sucesso é exibida

### Editar Instalação Manualmente
- [ ] Formulário de edição carrega dados atuais
- [ ] Todos os campos podem ser alterados
- [ ] Validações são aplicadas na edição
- [ ] Alterações são salvas corretamente
- [ ] Histórico de alterações é mantido (se aplicável)
- [ ] Mudanças são refletidas na listagem

### Marcar como Instalado
- [ ] Checkbox/botão para marcar como instalado está disponível
- [ ] Status muda visualmente ao marcar como instalado
- [ ] Data de instalação é registrada automaticamente
- [ ] Usuário que marcou é registrado (se aplicável)
- [ ] Filtro de instalados/não instalados reflete mudança imediatamente
- [ ] Ação pode ser desfeita (desmarcar como instalado)

### Campo de Observações
- [ ] Campo aceita texto longo (múltiplas linhas)
- [ ] Formatação básica é preservada (quebras de linha)
- [ ] Limite de caracteres é adequado (ex: 2000 caracteres)
- [ ] Observações são salvas e persistidas
- [ ] Observações são exibidas na visualização da instalação

### Diretrizes X e Y
- [ ] Campos aceitam valores numéricos (inteiros ou decimais)
- [ ] Validação impede valores não numéricos
- [ ] Valores negativos são tratados conforme regra de negócio
- [ ] Campos podem ficar vazios (se opcional)
- [ ] Valores são exibidos corretamente na listagem
- [ ] Valores são usados corretamente em relatórios

---

## 4. Fotos

### Upload Múltiplo
- [ ] Botão de upload permite seleção de múltiplas fotos
- [ ] Drag and drop funciona para adicionar fotos
- [ ] Formatos aceitos: JPG, JPEG, PNG
- [ ] Tamanho máximo por foto é validado (ex: 10MB)
- [ ] Preview das fotos selecionadas é exibido
- [ ] Fotos podem ser removidas antes do upload
- [ ] Progress bar mostra andamento do upload
- [ ] Upload em lote processa todas as fotos selecionadas
- [ ] Erros de upload são exibidos por foto

### Compressão Automática
- [ ] Fotos maiores que limite configurado são comprimidas
- [ ] Qualidade da compressão é aceitável (não pixelizada)
- [ ] Tamanho final das fotos é reduzido significativamente
- [ ] Compressão não afeta fotos já pequenas
- [ ] Orientação das fotos é preservada (EXIF)
- [ ] Metadados importantes são mantidos

### Visualização em Galeria
- [ ] Galeria exibe todas as fotos do projeto
- [ ] Layout de grid é responsivo
- [ ] Thumbnails carregam rapidamente
- [ ] Click em foto abre visualização em tamanho maior
- [ ] Modal de visualização permite navegação entre fotos
- [ ] Botão de fechar modal funciona
- [ ] Zoom na foto funciona (se aplicável)
- [ ] Gestos de swipe funcionam em mobile (se aplicável)

### Lazy Loading
- [ ] Fotos são carregadas conforme usuário faz scroll
- [ ] Placeholder é exibido enquanto foto carrega
- [ ] Scroll é suave mesmo com muitas fotos
- [ ] Performance é aceitável com 100+ fotos
- [ ] Imagens fora da viewport não são carregadas
- [ ] Carregamento antecipado de próximas fotos funciona

### Badges com InstallationId
- [ ] Badge com installationId é exibido em cada foto
- [ ] InstallationId corresponde à instalação correta
- [ ] Badge é claramente visível na galeria
- [ ] Click no badge filtra/navega para a instalação (se aplicável)
- [ ] Fotos sem installationId são identificadas
- [ ] InstallationId pode ser editado/atribuído posteriormente

### Sincronização com Galeria do Projeto
- [ ] Fotos adicionadas aparecem automaticamente na galeria
- [ ] Fotos removidas são removidas da galeria
- [ ] Ordem das fotos é consistente
- [ ] Sincronização em tempo real funciona (se multi-usuário)
- [ ] Contador de fotos é atualizado corretamente

---

## 5. Relatórios

### Geração PDF
- [ ] Botão de gerar PDF está disponível
- [ ] Modal de configuração permite personalização
- [ ] PDF é gerado corretamente com dados do projeto
- [ ] Layout do PDF é profissional e legível
- [ ] Logos e cabeçalhos são incluídos
- [ ] Tabela de instalações é formatada corretamente
- [ ] Fotos são incluídas no PDF (se selecionado)
- [ ] Qualidade das fotos no PDF é aceitável
- [ ] Geração de PDF com 600 instalações completa em tempo razoável
- [ ] PDF pode ser baixado
- [ ] PDF pode ser visualizado no navegador

### Geração Excel
- [ ] Botão de gerar Excel está disponível
- [ ] Excel é gerado com todas as instalações
- [ ] Colunas incluem todos os campos relevantes
- [ ] Formatação do Excel é adequada (cabeçalhos, largura de colunas)
- [ ] Dados numéricos são formatados como números
- [ ] Datas são formatadas corretamente
- [ ] Excel pode ser baixado
- [ ] Excel pode ser aberto no Microsoft Excel/Google Sheets
- [ ] Fórmulas são incluídas (se aplicável)

### Seletor de Destinatário (Cliente/Fornecedor)
- [ ] Opção de seleção de destinatário está disponível
- [ ] Seleção de "Cliente" personaliza relatório adequadamente
- [ ] Seleção de "Fornecedor" personaliza relatório adequadamente
- [ ] Informações sensíveis são ocultadas conforme destinatário
- [ ] Linguagem/terminologia muda conforme destinatário
- [ ] Dados financeiros são incluídos/excluídos conforme regra

### Hyperlinks de Fotos Funcionando
- [ ] Fotos no PDF têm hyperlinks (se aplicável)
- [ ] Click no hyperlink abre foto em navegador/app
- [ ] Links expiram após período configurado (se segurança for preocupação)
- [ ] Links funcionam mesmo após logout (se público)
- [ ] Links são curtos e amigáveis

### Histórico de Relatórios
- [ ] Lista de relatórios gerados anteriormente está disponível
- [ ] Data e hora de geração são exibidas
- [ ] Tipo de relatório (PDF/Excel) é identificado
- [ ] Destinatário é identificado
- [ ] Usuário que gerou é registrado
- [ ] Relatórios antigos podem ser baixados novamente
- [ ] Relatórios podem ser excluídos
- [ ] Limite de armazenamento é respeitado

### Customização
- [ ] Opção de incluir/excluir fotos
- [ ] Opção de incluir/excluir instalações não instaladas
- [ ] Filtros de data podem ser aplicados
- [ ] Campos personalizados podem ser adicionados (se aplicável)
- [ ] Logo da empresa pode ser personalizado
- [ ] Cores e tema podem ser personalizados (se aplicável)
- [ ] Template customizado é salvo para reutilização

---

## 6. Sincronização

### Auto-sync Funcionando
- [ ] Mudanças locais são sincronizadas automaticamente
- [ ] Intervalo de sincronização é adequado (ex: 30 segundos)
- [ ] Sincronização ocorre em background sem bloquear UI
- [ ] Indicador de "sincronizando" é exibido
- [ ] Indicador de "sincronizado" é exibido após sucesso
- [ ] Sincronização funciona para todos os tipos de dados
- [ ] Performance não é impactada durante sync

### Modo Offline
- [ ] Aplicação detecta quando está offline
- [ ] Banner/notificação de modo offline é exibido
- [ ] CRUD de instalações funciona offline
- [ ] CRUD de projetos funciona offline
- [ ] Upload de fotos é enfileirado para quando voltar online
- [ ] Dados são salvos localmente (IndexedDB/LocalStorage)
- [ ] Ao voltar online, dados são sincronizados automaticamente

### Indicador de Pendências
- [ ] Número de alterações pendentes de sincronização é exibido
- [ ] Badge/contador mostra quantidade de pendências
- [ ] Click no indicador mostra detalhes das pendências
- [ ] Pendências são agrupadas por tipo (instalações, fotos, etc.)
- [ ] Indicador desaparece quando tudo está sincronizado

### Resolução de Conflitos
- [ ] Conflitos são detectados automaticamente
- [ ] UI exibe quando há conflito
- [ ] Opções de resolução são apresentadas (manter local/remoto/mesclar)
- [ ] Escolha do usuário resolve conflito
- [ ] Estratégia de "last write wins" funciona (se automática)
- [ ] Dados não são perdidos em conflitos
- [ ] Histórico de conflitos é mantido (se aplicável)

---

## 7. Colaboração

### Múltiplos Usuários
- [ ] Vários usuários podem acessar o mesmo projeto simultaneamente
- [ ] Permissões são respeitadas (admin, editor, visualizador)
- [ ] Alterações de um usuário não sobrescrevem alterações de outro
- [ ] Cada usuário vê dados atualizados
- [ ] Limite de usuários simultâneos é respeitado (se houver)

### Presença em Tempo Real
- [ ] Indicador mostra quais usuários estão online
- [ ] Avatar/nome de usuários ativos é exibido
- [ ] Indicador mostra em qual seção cada usuário está
- [ ] Presença é atualizada em tempo real
- [ ] Presença desaparece quando usuário sai/fica inativo
- [ ] Cursor/edição de outro usuário é visível (se aplicável)

### Notificações
- [ ] Notificações são exibidas quando outro usuário faz alterações
- [ ] Notificação de novo comentário (se aplicável)
- [ ] Notificação de atribuição de tarefa (se aplicável)
- [ ] Notificações podem ser marcadas como lidas
- [ ] Histórico de notificações está acessível
- [ ] Preferências de notificação podem ser configuradas
- [ ] Notificações push funcionam (se aplicável)

---

## 8. Performance

### Carregamento Inicial < 3s
- [ ] Página inicial carrega em menos de 3 segundos em conexão 3G
- [ ] Página inicial carrega em menos de 1 segundo em conexão WiFi
- [ ] Splash screen/loading state é exibido durante carregamento
- [ ] Critical CSS é carregado primeiro
- [ ] JavaScript é carregado de forma otimizada (code splitting)
- [ ] Fontes e assets são otimizados
- [ ] Cache de recursos estáticos funciona

### Importação de 600 Instalações < 60s
- [ ] Importação de 600 instalações via Excel completa em menos de 60 segundos
- [ ] Progress bar mostra andamento preciso
- [ ] UI permanece responsiva durante importação
- [ ] Memória não cresce excessivamente durante importação
- [ ] Importação em lote é otimizada (batch inserts)
- [ ] Validações não degradam performance significativamente

### Scroll Suave na Galeria
- [ ] Scroll é fluido a 60fps
- [ ] Sem travamentos ao fazer scroll rápido
- [ ] Lazy loading não causa jumps/jitters
- [ ] Performance é boa com 100+ fotos
- [ ] Animações são suaves
- [ ] Sem memory leaks em scroll prolongado

### Compressão de Imagens Funcionando
- [ ] Compressão reduz tamanho de imagem em pelo menos 50%
- [ ] Compressão é executada no cliente (não no servidor)
- [ ] Worker thread/WebWorker é usado para não bloquear UI
- [ ] Qualidade das imagens comprimidas é aceitável
- [ ] Fotos já otimizadas não são recomprimidas
- [ ] EXIF orientation é respeitado após compressão
- [ ] Múltiplas imagens podem ser comprimidas em paralelo

---

## Critérios de Aceitação Global

Todos os itens acima devem ser verificados antes do deploy em produção. Além disso:

- [ ] **Responsividade**: Todas as funcionalidades funcionam em desktop, tablet e mobile
- [ ] **Navegadores**: Testado e funcionando em Chrome, Firefox, Safari e Edge
- [ ] **Acessibilidade**: Navegação por teclado funciona, contrast ratio adequado, labels em inputs
- [ ] **SEO**: Meta tags adequadas, sitemap configurado (se aplicável)
- [ ] **Segurança**: Autenticação funciona, tokens expiram, inputs são sanitizados
- [ ] **Logs**: Erros são logados adequadamente para debugging
- [ ] **Monitoramento**: Analytics/APM configurado e funcionando
- [ ] **Backup**: Estratégia de backup está implementada e testada
- [ ] **Documentação**: README e documentação técnica estão atualizados

---

## Notas

- **Data de Criação**: 2025-10-21
- **Responsável pela Validação**: _[Nome do responsável]_
- **Ambiente de Teste**: _[Staging/QA URL]_
- **Data de Conclusão**: _[Data]_
- **Status Final**: _[Aprovado/Reprovado]_

---

**Assinatura do Validador**: ________________________  
**Data**: ___/___/_____
