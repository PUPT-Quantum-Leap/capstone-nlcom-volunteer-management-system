# Supabase Email Not Sending - Fix Guide

## Problem
- ✅ Invite saves in Supabase (user created)
- ❌ Email never arrives in Gmail inbox

## Common Causes & Fixes

### 1. Supabase Free Tier Rate Limit (MOST COMMON)
**Issue**: Supabase free tier allows only ~3 emails per hour per project.

**Fix**: 
- Wait 1 hour and try again
- Or upgrade to Pro plan for higher limits
- Check spam folder for delayed emails

### 2. Missing Redirect URL in Supabase Dashboard
**Issue**: Supabase won't send emails if the `redirect_to` URL isn't whitelisted.

**Fix**:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. **Authentication** → **URL Configuration**
4. Add these URLs to "Redirect URLs":
   ```
   http://localhost:4200/auth/callback
   http://localhost:4200/signup
   http://localhost:4200/signup-form
   http://localhost:4200/admin-auth
   ```
5. Also add your production URLs if deployed

### 3. Email Confirmations Not Enabled
**Fix**:
1. **Authentication** → **Providers** → **Email**
2. Make sure **"Confirm email"** is turned **ON**
3. Enable **"Secure email change"** and **"Secure password change"**

### 4. Email Templates Misconfigured
**Fix**:
1. **Authentication** → **Email Templates**
2. Check that "Confirm signup" template exists and has the `{{ .ConfirmationURL }}` variable
3. Default template should look like:
   ```
   <h2>Confirm your signup</h2>
   <p>Follow this link to confirm your user:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
   ```

### 5. Email Going to Spam
**Check**: Look in Gmail's **Spam** or **Junk** folder

**Fix**: 
- Mark as "Not spam" in Gmail
- Add `noreply@supabase.io` to your contacts
- The sender is usually: `noreply@supabase.io` or `noreply@mail.supabase.io`

### 6. Project Paused or Restricted
**Check**: 
1. Go to Supabase Dashboard → Project Settings
2. Check if project shows any warnings or restrictions

## How to Test

Run the diagnostic command:
```bash
cd servetrack-backend
php artisan supabase:test-email your-email@gmail.com
```

## Alternative: Use Custom SMTP (Recommended for Production)

If Supabase's default email keeps failing, configure your own SMTP:

1. **Authentication** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Use Gmail SMTP:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: your-email@gmail.com
   - Password: [App Password](https://myaccount.google.com/apppasswords) (NOT your Gmail password)
   - Encryption: `TLS`

## Quick Checklist

- [ ] Checked Gmail spam folder
- [ ] Added redirect URLs to Supabase dashboard
- [ ] Email confirmations enabled in Auth settings
- [ ] Waited 1 hour (rate limit)
- [ ] Project not paused/restricted
- [ ] Using valid email format

## Still Not Working?

Check Supabase Logs:
1. Dashboard → **Logs** → **Auth**
2. Look for email sending errors
3. Contact Supabase support if all settings are correct
