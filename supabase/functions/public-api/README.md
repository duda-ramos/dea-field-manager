# DEA Field Manager - API Pública

## Autenticação

Todas as requisições requerem uma API Key no header Authorization:
```bash
Authorization: Bearer sua-api-key-aqui
```

### Como obter uma API Key:
1. Acesse o sistema DEA Field Manager
2. Vá em Configurações > API Keys
3. Clique em "Gerar Nova Key"
4. Copie e armazene a key com segurança (ela não será mostrada novamente)

## Rate Limiting
- 100 requisições por minuto por API Key
- Header `X-RateLimit-Remaining` mostra requisições restantes

## Endpoints

### Listar Projetos
```bash
GET /projects
curl -H "Authorization: Bearer sua-key" \
  https://[projeto].supabase.co/functions/v1/public-api/projects
```

**Query Parameters:**
- `status`: Filtrar por status (planning, in-progress, completed)

**Resposta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Projeto X",
      "client": "Cliente Y",
      "city": "São Paulo",
      "status": "in-progress"
    }
  ]
}
```

### Criar Projeto
```bash
POST /projects
curl -X POST \
  -H "Authorization: Bearer sua-key" \
  -H "Content-Type: application/json" \
  -d '{"name":"Novo Projeto","client":"Cliente","city":"SP"}' \
  https://[projeto].supabase.co/functions/v1/public-api/projects
```

### Listar Instalações
```bash
GET /projects/{id}/installations
curl -H "Authorization: Bearer sua-key" \
  https://[projeto].supabase.co/functions/v1/public-api/projects/{id}/installations
```

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 401 | API Key inválida ou ausente |
| 404 | Recurso não encontrado |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |

## Exemplos com JavaScript
```javascript
// Usando fetch
const response = await fetch(
  'https://[projeto].supabase.co/functions/v1/public-api/projects',
  {
    headers: {
      'Authorization': 'Bearer sua-api-key'
    }
  }
);
const data = await response.json();
```

## Suporte
Para dúvidas ou problemas, entre em contato através do sistema.
