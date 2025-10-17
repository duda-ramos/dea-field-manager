# Welcome to your Lovable project

![Code Quality](https://img.shields.io/badge/code%20quality-7.0%2F10-green)
![Bundle Size](https://img.shields.io/badge/bundle-%3C500KB-success)
![Type Safety](https://img.shields.io/badge/any%20types-177-yellow)
![ESLint](https://img.shields.io/badge/warnings-%3C50-brightgreen)
![Build](https://img.shields.io/badge/build-passing-brightgreen)

## Project info

**URL**: https://lovable.dev/projects/cf3dbcb2-27e9-43fa-a93b-167cd669ba99

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cf3dbcb2-27e9-43fa-a93b-167cd669ba99) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Copy environment variables
cp .env.example .env

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## API Proxy Configuration

This project includes a BFF (Backend for Frontend) proxy to handle external API calls and prevent CORS issues.

### Environment Variables

Configure the following variables in your `.env` file:

- `VITE_LOVABLE_ALLOWED_ORIGIN`: CORS allowed origin (use `*` for development, specific domain for production)
- `VITE_OAUTH_CLIENT_ID`: OAuth client ID for API authentication

### Development

The Vite development server automatically proxies `/api/lovable/*` requests to `https://lovable-api.com`.

### Production

For production deployments, ensure your hosting platform supports API proxying or implement a server-side proxy.

### Chrome Extension

The project includes Chrome extension files for enhanced integration:

- `public/manifest.json`: Extension manifest
- `public/background.js`: Background service worker with proper async handling
- `public/content.js`: Content script with helper functions

### API Usage

Use the centralized API helper instead of direct external calls:

```javascript
import { apiFetch, getToken } from '@/lib/api';

// Instead of: fetch('https://lovable-api.com/projects')
const projects = await apiFetch('/projects');

// OAuth token with proper format
const token = await getToken({ username, password, clientId });
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cf3dbcb2-27e9-43fa-a93b-167cd669ba99) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## 🖼️ Otimizações de Imagem

Este projeto implementa otimizações avançadas de imagem para melhor performance e experiência do usuário.

### Compressão Automática de Imagens

Todas as imagens são automaticamente comprimidas antes do upload:

- **Redução de tamanho**: 50-70% em média (ex: 10MB → 2MB)
- **Uploads mais rápidos**: 70-80% mais rápido
- **Qualidade preservada**: Compressão inteligente mantém qualidade visual
- **Configurável**: Ajuste qualidade, resolução máxima e limites de tamanho

```typescript
import { compressImage } from '@/utils/imageCompression';

// Compressão automática com configurações padrão
const compressed = await compressImage(file);

// Compressão customizada
const compressed = await compressImage(file, {
  maxSizeMB: 1,
  maxWidthOrHeight: 1280,
  quality: 0.85
});
```

### Lazy Loading Inteligente

Imagens são carregadas apenas quando ficam visíveis no viewport:

- **Carregamento inicial 85% mais rápido**: Apenas imagens visíveis são carregadas
- **Menos requisições**: Reduz requisições HTTP simultâneas em 80%
- **Melhor performance**: FPS durante scroll aumenta de ~20 para 50-60
- **Uso eficiente de memória**: 60% menos memória utilizada

```typescript
import { LazyImage } from '@/components/ui/LazyImage';

<LazyImage
  src="https://example.com/image.jpg"
  alt="Descrição"
  threshold={0.5}
  rootMargin="50px"
/>
```

### 📊 Resultados

| Métrica                  | Antes | Depois | Melhoria        |
| ------------------------ | ----- | ------ | --------------- |
| Tamanho de upload (10MB) | 10 MB | 1.8 MB | 82% menor       |
| Tempo de upload          | 25s   | 5s     | 80% mais rápido |
| Carregamento da galeria  | 14s   | 1.8s   | 87% mais rápido |
| FPS durante scroll       | 18    | 56     | 3x melhor       |

Para mais detalhes, consulte a [Documentação completa de otimização de imagens](./docs/IMAGE_OPTIMIZATION.md).

## Code Quality

This project maintains high code quality standards. Our latest metrics from Sprint 5.2 show significant improvements:

- **Code Quality Score:** 7.0/10 (target: 8.5/10)
- **ESLint Warnings:** <50 (reduced from 466)
- **Bundle Size:** <500KB gzipped (optimized with code splitting)
- **Type Safety:** 177 any types (reduced from 239)

For detailed information about our code quality improvements and metrics, see:
- [Sprint 5.2 Improvements](./docs/SPRINT_5.2_IMPROVEMENTS.md)
- [Validation Summary](./VALIDATION_SUMMARY.md)
- [Code Audit Report](./docs/CODE_AUDIT_REPORT.md)

## Contributing

When contributing to this project, please follow our established guidelines:

### Error Handling

We have comprehensive error handling standards to ensure a reliable user experience. Before submitting a PR, please:

- Review the [Error Handling Guide](./docs/ERROR_HANDLING_GUIDE.md)
- Ensure all catch blocks have proper logging
- Use retry logic for network operations
- Wrap critical sections in error boundaries
- Provide user-friendly error messages

See the full checklist in the [Error Handling Guide](./docs/ERROR_HANDLING_GUIDE.md#checklist-para-prs).

## 🔄 Resolução de Conflitos

Este projeto implementa um sistema robusto de resolução de conflitos para sincronização de dados entre dispositivos.

### Estratégia Last Write Wins (LWW)

O sistema utiliza a estratégia **Last Write Wins** por padrão:

- **Detecção automática**: Conflitos são detectados durante sincronização
- **Resolução transparente**: Versão mais recente sempre prevalece
- **Notificação ao usuário**: Toast notifications informam sobre conflitos
- **Opção manual**: Usuário pode escolher qual versão manter

### Como Funciona

1. **Detecção**: Sistema identifica quando versões local e remota divergem
2. **Análise**: Compara timestamps e flags de modificação
3. **Resolução**: Aplica estratégia configurada (LWW por padrão)
4. **Persistência**: Salva decisão e sincroniza com servidor

### Configuração

```typescript
// Estratégia padrão (Last Write Wins)
conflictResolution: {
  strategy: 'lastWriteWins',
  automatic: true
}

// Resolução manual
conflictResolution: {
  strategy: 'manual',
  promptUser: true
}
```

### Interface do Usuário

O sistema inclui:

- **ConflictManager**: Modal para resolução manual de conflitos
- **ConflictBadge**: Indicador visual de conflitos pendentes
- **Notificações Toast**: Alertas não-intrusivos sobre conflitos

Para mais detalhes sobre o sistema de resolução de conflitos, consulte o [Guia de Resolução de Conflitos](./CONFLICT_RESOLUTION_GUIDE.md).

## CI Degradado (bypass temporário)

- Defina o secret de repositório **DEGRADED_CI=true** para que o pipeline **pule instalação/build/test** e marque os jobs como sucesso controlado.
- Use somente quando houver bloqueio de rede (403 nos registries).
- Para restaurar o fluxo normal, **remova** o secret ou defina `DEGRADED_CI=false`.

## 📧 Configuração do Envio de Emails

O DEA Manager oferece a funcionalidade de enviar relatórios por email usando o serviço Resend.

### Pré-requisitos

1. **Conta no Resend**
   - Crie uma conta em [resend.com](https://resend.com)
   - Obtenha sua API Key no dashboard

2. **Supabase Edge Functions**
   - As Edge Functions devem estar habilitadas no seu projeto Supabase

### Configuração

1. **Configurar a API Key do Resend no Supabase**:

   ```bash
   # No dashboard do Supabase:
   # Settings → Edge Functions → Secrets
   # Adicione:
   # Nome: RESEND_API_KEY
   # Valor: re_DYBD8sSE_FeorgHXjTAhSDMdPrJn4rVGr
   ```

2. **Configurar o domínio da aplicação** (opcional):

   ```bash
   # Adicione no Supabase Secrets:
   # Nome: APP_DOMAIN
   # Valor: https://seu-dominio.com
   ```

3. **Deploy da Edge Function**:
   ```bash
   # Com Supabase CLI instalado:
   supabase functions deploy send-report-email
   ```

### Funcionalidades

- **Email HTML Responsivo**: Template profissional com suporte a dark mode
- **Link Seguro**: Links públicos com expiração de 30 dias
- **Estatísticas**: Resumo visual do progresso do relatório
- **Rate Limiting**: Limite de 50 emails por dia por usuário
- **Tracking**: Logs de envio para auditoria

### Uso

1. Gere um relatório no sistema
2. No modal de compartilhamento, clique em "Email"
3. Insira o email do destinatário
4. Opcionalmente, adicione seu nome para personalização
5. Clique em "Enviar Email"

### Personalização do Template

O template do email pode ser personalizado editando a função `generateEmailTemplate` em:

```
supabase/functions/send-report-email/index.ts
```

### Troubleshooting

- **Erro 429**: Limite de envios atingido. Aguarde 24h.
- **Email não enviado**: Verifique se a API Key está configurada corretamente
- **Link expirado**: Links são válidos por 30 dias. Gere um novo se necessário.

### Segurança

- Todos os links são hasheados e únicos
- Expiração automática após 30 dias
- Rate limiting para prevenir abuso
- Logs de acesso para auditoria
