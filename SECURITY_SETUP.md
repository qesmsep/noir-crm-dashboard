# Security Setup Guide

## 🔐 Encryption Key Configuration

The application uses AES-256-GCM encryption to protect sensitive data like API keys stored in the database. This requires proper configuration of the `ENCRYPTION_KEY` environment variable.

### 🚀 Quick Setup

1. **Generate a secure encryption key:**
   ```bash
   openssl rand -hex 32
   ```
   This will output a 64-character hex string like:
   ```
   a3f2c1b8e9d7a5c3f1b9e7d5a3c1f9b7e5d3a1c9f7b5e3d1a9c7f5b3e1d9a7c5
   ```

2. **Add to your environment file:**
   ```bash
   # .env.local (for development)
   ENCRYPTION_KEY=your_generated_key_here
   ```

3. **For production deployment:**
   - Add the key to your hosting provider's environment variables
   - For Vercel: `vercel env add ENCRYPTION_KEY`
   - For other platforms: Check their documentation for environment variable configuration

### ⚠️ Important Security Notes

1. **Never commit the encryption key to version control**
   - The `.env.local` file should be in `.gitignore`
   - Use environment variables in production

2. **Keep the key secure**
   - Store it in a password manager
   - Backup the key securely - losing it means encrypted data cannot be recovered
   - Use different keys for development, staging, and production

3. **Key rotation**
   - If you need to rotate the key, you'll need to decrypt all data with the old key and re-encrypt with the new key
   - Plan key rotation carefully in production

### 🔍 Verifying Configuration

Run the verification script to ensure encryption is properly configured:
```bash
node scripts/verify-encryption.js
```

This will:
- Check if the ENCRYPTION_KEY is set
- Validate the key format
- Test encryption/decryption functionality
- Check for any unencrypted sensitive settings in the database

### 🛠 Troubleshooting

**Error: "ENCRYPTION_KEY environment variable is required in production"**
- Ensure you've set the ENCRYPTION_KEY environment variable in production
- Check that the variable is accessible to the Node.js process

**Error: "ENCRYPTION_KEY must be a 32-byte hex string"**
- The key must be exactly 64 hexadecimal characters
- Regenerate using: `openssl rand -hex 32`

**Error: "Failed to decrypt data"**
- This usually means the data was encrypted with a different key
- Check if the ENCRYPTION_KEY has changed
- Ensure you're using the correct key for the environment

### 📊 Monitoring Encryption Status

Check the encryption status of your system settings:
```sql
-- View encryption status
SELECT * FROM v_encryption_status;

-- Check for unencrypted sensitive settings
SELECT setting_key, is_encrypted
FROM system_settings
WHERE (setting_key LIKE '%api_key%'
   OR setting_key LIKE '%secret%'
   OR setting_key LIKE '%token%')
   AND is_encrypted = false;
```

### 🔄 Encrypting Existing Data

If you have existing unencrypted API keys in the database:

1. Ensure the ENCRYPTION_KEY is set in your environment
2. Run the encryption script:
   ```bash
   npx tsx scripts/encrypt-api-keys.ts
   ```

This will:
- Find all unencrypted sensitive settings
- Encrypt them using the configured key
- Mark them as encrypted in the database

### 🎯 Best Practices

1. **Use strong keys**: Always use cryptographically secure random keys
2. **Environment isolation**: Use different keys for dev/staging/production
3. **Access control**: Limit who has access to the encryption keys
4. **Audit trail**: Monitor access to encrypted data
5. **Regular backups**: Backup both the encrypted data and the keys (separately)
6. **Key escrow**: Consider using a key management service for production

### 📚 Additional Resources

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [AES-GCM Encryption](https://en.wikipedia.org/wiki/Galois/Counter_Mode)

---

## 🔒 Other Security Configurations

### Rate Limiting

The application includes built-in rate limiting for:
- API endpoints: 100 requests per minute
- AI parsing: 10 requests per minute
- File uploads: 20 uploads per 5 minutes

These can be configured in `src/lib/rate-limiter.ts`

### API Security

- All API endpoints require authentication
- Admin endpoints have additional authorization checks
- Request validation using Zod schemas
- SQL injection protection via parameterized queries

### File Upload Security

- File type validation (JPEG/PNG only for receipts)
- File size limits (5MB default)
- Image optimization and sanitization
- Secure storage in Supabase Storage

---

For questions or security concerns, please contact the security team.
