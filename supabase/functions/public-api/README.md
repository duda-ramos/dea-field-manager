# Public API - Project Management

Este diretório contém a especificação OpenAPI e instruções de uso da API pública exposta pelo Function `public-api` do Supabase.

## Autenticação

- Tipo: Bearer API Key
- Header: `Authorization: Bearer <SUA_API_KEY>`

As chaves são gerenciadas na tabela `api_keys` e validadas por hash (bcrypt). Evite expor sua chave em clientes públicos.

## Base URL

```
https://<PROJECT_REF>.supabase.co/functions/v1/public-api
```

## Documentação (OpenAPI)

O arquivo `openapi.yaml` descreve os endpoints, parâmetros e esquemas de resposta.

## Rate limits

- Sugerido: 60 requisições/minuto por chave
- Ao exceder, retorne 429 e implemente retry exponencial no cliente

## Endpoints

### 1) Listar projetos

```
GET /projects?cliente=XYZ&status=in_progress
```

Exemplo (curl):

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://$PROJECT_REF.supabase.co/functions/v1/public-api/projects?cliente=XYZ&status=in_progress"
```

Exemplo (fetch):

```js
const base = `https://${PROJECT_REF}.supabase.co/functions/v1/public-api`;
const res = await fetch(`${base}/projects?cliente=XYZ&status=in_progress`, {
  headers: { Authorization: `Bearer ${API_KEY}` },
});
const body = await res.json();
```

### 2) Detalhar projeto

```
GET /projects/:id
```

Exemplo (curl):

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://$PROJECT_REF.supabase.co/functions/v1/public-api/projects/PROJECT_ID"
```

### 3) Criar projeto

```http
POST /projects
Content-Type: application/json
{
  "name": "Residencial Aurora",
  "client": "Construtora XYZ",
  "city": "São Paulo",
  "code": "AUR-001",
  "status": "planning"
}
```

### 4) Atualizar projeto

```http
PUT /projects/:id
Content-Type: application/json
{
  "status": "in_progress"
}
```

### 5) Adicionar instalação

```http
POST /projects/:id/installations
Content-Type: application/json
{
  "codigo": 101,
  "descricao": "Ponto de Tomada",
  "tipologia": "Elétrica",
  "pavimento": "Térreo",
  "quantidade": 2,
  "installed": false,
  "photos": [
    { "url": "https://storage.supabase.co/path/to/photo.jpg", "type": "image/jpeg", "size": 123456 }
  ]
}
```

Observação: uploads binários de fotos devem ser feitos ao storage; envie as URLs no campo `photos`.

## Códigos de erro comuns

- 400: Dados inválidos
- 401: API key inválida/ausente
- 403: Permissões insuficientes
- 404: Recurso não encontrado
- 429: Rate limit excedido
- 500: Erro interno
