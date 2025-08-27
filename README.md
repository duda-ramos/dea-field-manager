# Welcome to your Lovable project

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

## CI Degradado (bypass temporário)

- Defina o secret de repositório **DEGRADED_CI=true** para que o pipeline **pule instalação/build/test** e marque os jobs como sucesso controlado.
- Use somente quando houver bloqueio de rede (403 nos registries).
- Para restaurar o fluxo normal, **remova** o secret ou defina `DEGRADED_CI=false`.
