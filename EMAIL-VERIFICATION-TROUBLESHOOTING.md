# Email Verification Troubleshooting Guide

## What I Fixed

### 1. **verify.html** - Complete Redesign
- ✅ Added comprehensive debug logging to console
- ✅ Shows detailed status messages and debug info to user
- ✅ Properly handles both OAuth code exchange and OTP verification
- ✅ Better error messages with actionable instructions
- ✅ Logs every step so you can see exactly where it fails (open browser DevTools with F12)
- ✅ Better session persistence handling

### 2. **login.html** - Enhanced Error Visibility  
- ✅ Larger, more prominent error messages with colored left border
- ✅ Improved error descriptions (shows what to do to fix it)
- ✅ Better console logging for debugging
- ✅ Animations when messages appear

---

## How to Debug Email Verification Issues

### Step 1: Check Browser Console
When you click the email verification link:
1. Open browser DevTools: **F12** on Windows
2. Go to **Console** tab
3. Look for messages starting with `[timestamp] [INFO/ERROR]`
4. You'll see exactly where the verification is failing

### Step 2: Check the Email Link Format
Supabase sends verification emails with URLs like:
```
https://yoursite.com/verify.html?code=ABC123...
```
or
```
https://yoursite.com/verify.html#token_hash=...&type=signup
```

The verify.html page now handles both formats automatically.

### Step 3: Verify Supabase Email Configuration
In **Supabase Dashboard** → Your Project → **Authentication** → **Providers** → **Email**:

1. **Email Confirmations**: Should be **ENABLED** (not optional)
2. **Email confirmation redirect URL**: Should be set to your app's verify page:
   ```
   https://yourdomain.com/verify.html
   ```
3. **Email rate limit**: Check it's not too restrictive

### Step 4: Check Email Settings
In **Supabase Dashboard** → **Settings** → **Email**:
- Email service should be configured (SMTP or SendGrid)
- Test email should work

---

## Common Issues & Solutions

### Issue: "Email verified but redirects to login"
**Cause**: Session not created after verification
**Solution**: 
1. Check browser console (F12) for errors
2. Verify Supabase email confirmation is ENABLED
3. Try signing up again with a new email

### Issue: "Cannot login with correct credentials"
**Cause**: Usually means email is not verified yet
**Solution**:
1. Check your inbox for verification email (check spam)
2. Click the link in the email
3. Check console (F12) for detailed error
4. If email didn't arrive: resend from signup page

### Issue: Error messages not visible in login.html
**Solution**: 
- Error messages now appear at the top with red border
- Check if page is scrolled to top
- Open console (F12) to see full error details

### Issue: "Invalid verification link" or "token expired"
**Cause**: Verification link is too old or already used
**Solution**:
1. Ask for new verification email
2. Use it within 24 hours
3. Each link can only be used once

---

## Testing the Flow

### Test Email Verification (Local Supabase)
If using local Supabase:

```bash
# In your supabase folder:
supabase start

# Check the Supabase dashboard at http://localhost:54323
# You'll see emails in the logs instead of sending them

# Look for links in format:
# http://localhost:5173/verify.html?code=...
```

### Full Test Flow:
1. Go to `http://localhost:5173/signup.html`
2. Enter email, password, username
3. Click "Create account"
4. Check Supabase logs for verification email
5. Copy verification link from logs
6. Paste in browser address bar
7. Should verify and redirect to home or login

---

## Environment Variables Needed

Make sure these are set in your `.env.local`:
```
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=your-public-key
```

And in `public/runtime-env.js`:
```javascript
window.__DECENTRA_ENV__ = {
  SUPABASE_URL: "https://[project-id].supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "your-public-key",
};
```

---

## If Still Having Issues

1. **Open F12 Console** - copy all error messages
2. **Check Supabase Dashboard**:
   - Go to "Authentication" → "Users"
   - Find your test user
   - Check if email_confirmed is `true` or `false`
3. **Check Supabase Logs**:
   - "Authentication" → "Logs"
   - Look for signup and verification events
4. **Check Email Configuration**:
   - Settings → Email
   - Do a test email send

---

## Key Files Modified

- `public/verify.html` - Email verification page with better error handling and debug logging
- `public/login.html` - Improved error messages and styling

Both files now have detailed console logging to help debug issues. Open F12 and check the console for detailed information about what's happening.
