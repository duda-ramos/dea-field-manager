# Security Admin Quick Start Guide

**For Database Administrators and DevOps**

---

## ⚡ Quick Actions Required

### 🔴 CRITICAL - Do This First (5 minutes)

#### 1. Set Encryption Key
```bash
# Generate key
openssl rand -base64 32

# Copy output, then in Supabase SQL Editor:
```

```sql
ALTER DATABASE postgres SET app.storage_encryption_key = 'PASTE_KEY_HERE';
```

#### 2. Encrypt Existing Data
```sql
SELECT migrate_storage_configs_to_encrypted();
-- Wait for: "Successfully encrypted N storage integration configs"
```

#### 3. Verify
```sql
SELECT * FROM security_audit_summary WHERE table_name = 'storage_integrations';
-- Ensure unencrypted_count = 0
```

---

## 🟡 IMPORTANT - Do Within 24 Hours

### Enable Password Leak Protection
**Supabase Dashboard:**
1. Project Settings → Authentication
2. Enable "Check for leaked passwords"
3. Set threshold: Medium

**Or via SQL:**
```sql
-- Not directly configurable via SQL
-- Must use Supabase Dashboard
```

### Update Application Code
Find and replace in your codebase:
```typescript
// OLD:
.from('storage_integrations')

// NEW:
.from('storage_integrations_decrypted')
```

---

## 🟢 VERIFICATION - Test Everything Works

### Test 1: Audit Log Immutability ✅
```sql
-- Should FAIL with RLS error:
INSERT INTO project_audit_logs (project_id, user_id, action)
VALUES (gen_random_uuid(), auth.uid(), 'TEST');

-- Expected: "new row violates row-level security policy"
```

### Test 2: Storage Decryption ✅
```sql
-- Should return decrypted config for your integrations:
SELECT id, provider, config FROM storage_integrations_decrypted
WHERE user_id = auth.uid();

-- Verify config contains actual credentials, not {"status": "encrypted"}
```

### Test 3: Triggers Work ✅
```sql
-- Create test project (should auto-create audit log):
INSERT INTO projects (name, user_id)
VALUES ('Security Test', auth.uid())
RETURNING id;

-- Check audit log created:
SELECT * FROM project_audit_logs
WHERE action = 'INSERT'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 📊 Monitoring Setup

### Daily Health Check
```sql
-- Run this daily (or set up cron job):
SELECT * FROM detect_suspicious_audit_activity();
```

Set up alerts for:
- `severity = 'critical'` → Immediate alert
- `severity = 'high'` → Alert within 1 hour
- `severity = 'medium'` → Daily summary

### Weekly Security Review
```sql
-- Check encryption status:
SELECT * FROM security_audit_summary;

-- Review recent audit activity:
SELECT 
  'projects' as source,
  COUNT(*) as events,
  COUNT(DISTINCT user_id) as unique_users
FROM project_audit_logs
WHERE created_at > now() - interval '7 days'
UNION ALL
SELECT 
  'contacts',
  COUNT(*),
  COUNT(DISTINCT user_id)
FROM contact_access_logs
WHERE created_at > now() - interval '7 days';
```

---

## 🔐 Key Management

### Store Encryption Key Securely
1. **Production:** Supabase Vault (recommended)
2. **Backup:** 1Password/LastPass (team vault)
3. **Emergency:** Printed in safe (offline backup)

**DO NOT:**
- ❌ Commit to git
- ❌ Store in Slack/email
- ❌ Keep in plaintext files

### Key Rotation (Every 90 Days)
```sql
-- 1. Generate new key
-- openssl rand -base64 32

-- 2. Decrypt with old key, re-encrypt with new key
-- (Custom script required - contact security team)

-- 3. Update database setting
-- ALTER DATABASE postgres SET app.storage_encryption_key = 'NEW_KEY';
```

---

## 🐛 Common Issues

### "Encryption key not configured"
```sql
-- Check if key is set:
SHOW app.storage_encryption_key;

-- If not, set it:
ALTER DATABASE postgres SET app.storage_encryption_key = 'your-key';
```

### "Failed to decrypt storage configuration"
**Cause:** Wrong key or corrupted data

**Fix:**
```sql
-- Check which integrations are problematic:
SELECT id, provider, config_encrypted, encryption_version
FROM storage_integrations
WHERE config_encrypted = true;

-- Re-encrypt specific integration:
UPDATE storage_integrations
SET config_encrypted_data = encrypt_storage_config(config, 'correct-key')
WHERE id = 'problematic-uuid';
```

### Application Code Not Using Decrypted View
**Symptom:** Config shows `{"status": "encrypted"}`

**Fix:** Update all queries to use `storage_integrations_decrypted`:
```bash
# Find all instances:
grep -r "storage_integrations" src/
```

---

## 📞 Emergency Contacts

| Issue | Contact | Response Time |
|-------|---------|---------------|
| Security breach | security@company.com | Immediate |
| Encryption issues | devops@company.com | 1 hour |
| General questions | support@company.com | 24 hours |

---

## 📋 Deployment Checklist

```markdown
### Pre-Deployment
- [ ] Migration reviewed in staging
- [ ] Encryption key generated and stored securely
- [ ] Team notified of changes
- [ ] Rollback plan documented

### Deployment (Execute in order)
- [ ] Apply migration via Supabase CLI/Dashboard
- [ ] Set encryption key in database
- [ ] Run migrate_storage_configs_to_encrypted()
- [ ] Verify encryption status
- [ ] Test audit log policies
- [ ] Deploy application code updates

### Post-Deployment
- [ ] Run all verification tests
- [ ] Check application logs for errors
- [ ] Monitor detect_suspicious_audit_activity()
- [ ] Document any issues encountered
- [ ] Update team on completion

### Within 24 Hours
- [ ] Enable password leak protection
- [ ] Review security_audit_summary
- [ ] Verify monitoring alerts working
- [ ] Complete security review meeting
```

---

## 🔍 Audit Commands Reference

```sql
-- Check encryption status
SELECT * FROM security_audit_summary;

-- Detect suspicious activity
SELECT * FROM detect_suspicious_audit_activity();

-- View recent contact access
SELECT c.name, cal.action, cal.created_at, cal.user_id
FROM contact_access_logs cal
JOIN contacts c ON cal.contact_id = c.id
WHERE cal.created_at > now() - interval '1 day'
ORDER BY cal.created_at DESC;

-- View project changes
SELECT p.name, pal.action, pal.created_at, pal.changed_fields
FROM project_audit_logs pal
JOIN projects p ON pal.project_id = p.id
WHERE pal.created_at > now() - interval '1 day'
ORDER BY pal.created_at DESC;

-- Check API key usage
SELECT ak.name, akl.action, akl.created_at, akl.success
FROM api_key_audit_logs akl
JOIN api_keys ak ON akl.api_key_id = ak.id
WHERE akl.created_at > now() - interval '1 day'
ORDER BY akl.created_at DESC;

-- View storage integration access
SELECT si.provider, sia.action, sia.created_at
FROM storage_integration_audit sia
JOIN storage_integrations si ON sia.integration_id = si.id
WHERE sia.created_at > now() - interval '1 day'
ORDER BY sia.created_at DESC;
```

---

## 📖 Full Documentation

For detailed information, see:
- [CRITICAL_SECURITY_FIXES.md](./CRITICAL_SECURITY_FIXES.md) - Complete implementation guide
- [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) - Overall security architecture

---

**Last Updated:** 2025-10-22  
**Next Review:** 2025-11-22  
**Emergency Hotline:** Available 24/7
