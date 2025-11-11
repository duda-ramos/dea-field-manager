# 🚀 Guia Rápido: Configurar Email de Validação

## ⚡ Ação Imediata (5 minutos)

### 1️⃣ Acesse o Dashboard do Supabase

**Link direto**: https://supabase.com/dashboard/project/yfyousmorhjgoclxidwm/auth/url-configuration

### 2️⃣ Configure a Site URL

Na seção **"Site URL"**, coloque:

```
https://deamanager.lovable.app
```

### 3️⃣ Adicione as Redirect URLs

Na seção **"Redirect URLs"**, clique em **"Add URL"** e adicione cada uma dessas URLs:

```
https://deamanager.lovable.app/auth/confirm
https://deamanager.lovable.app/**
http://localhost:5173/auth/confirm
http://localhost:5173/**
```

**Nota**: Você precisará adicionar uma por vez. Clique em "Add URL" 4 vezes.

### 4️⃣ Verifique a Confirmação de Email

1. Clique em **"Providers"** no menu lateral
2. Clique em **"Email"**
3. Verifique se **"Confirm email"** está **✅ HABILITADO**
4. Se estiver desabilitado, habilite-o

### 5️⃣ Salve as Configurações

Clique no botão **"Save"** no final da página.

---

## ✅ Pronto!

Agora teste o fluxo de registro:

1. Acesse https://deamanager.lovable.app/auth/register
2. Registre uma nova conta
3. Verifique seu email (incluindo spam)
4. Clique no link de confirmação
5. Você será redirecionado e poderá fazer login

---

## 🐛 Se não funcionar

### Abra o Console do Navegador (F12)

Durante o registro, você deve ver logs como:

```
🔗 [Auth] Redirect URL: ...
📧 [Auth] SignUp - Email: seu@email.com | Redirect URL: ...
✅ [Auth] SignUp - Success! Check email for confirmation.
```

### Verifique os Logs do Supabase

Se o email não chegar, verifique:
- https://supabase.com/dashboard/project/yfyousmorhjgoclxidwm/logs/explorer
- Filtre por "auth" e "email"
- Procure por erros de envio

---

## 📚 Documentação Completa

Para mais detalhes, consulte:
- `DIAGNOSTICO_EMAIL_VALIDACAO.md` - Diagnóstico completo do problema
- `SOLUCAO_EMAIL_VALIDACAO.md` - Solução detalhada com troubleshooting

---

**Tempo estimado**: 5 minutos  
**Dificuldade**: Fácil  
**Requer**: Acesso ao Dashboard do Supabase
