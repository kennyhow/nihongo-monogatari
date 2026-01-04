# Supabase API Key Migration Guide (2024-2026)

## Overview

Supabase is transitioning from legacy API keys to a new, more secure system. This affects ALL projects using Supabase.

---

## What's Changing?

### Old System (Legacy)

| Key Name           | Format                                          | Purpose                             |
| ------------------ | ----------------------------------------------- | ----------------------------------- |
| `anon` key         | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT) | Client-side, unauthenticated access |
| `service_role` key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT) | Server-side, bypasses RLS           |

### New System (Current)

| Key Name              | Format               | Purpose                     |
| --------------------- | -------------------- | --------------------------- |
| **`publishable`** key | `sb_publishable_...` | Replaces `anon` key         |
| **`secret`** key      | `sb_secret_...`      | Replaces `service_role` key |

---

## Timeline

| Date                 | Event                                                    |
| -------------------- | -------------------------------------------------------- |
| **Q4 2024**          | New API keys introduced (opt-in)                         |
| **October 1, 2025**  | New projects use new API keys by default                 |
| **November 1, 2025** | Projects restored after this date won't have legacy keys |
| **Late 2026**        | Full deprecation of legacy keys                          |

---

## Why the Change?

### Problems with Legacy Keys:

- Both keys are JWT-based (signed with JWT secret)
- Must be rotated together (can't rotate independently)
- Use symmetric cryptography (less secure)

### Benefits of New Keys:

- Use asymmetric cryptography (more secure)
- Keys can be rotated independently
- Better security posture
- Industry-standard practice

---

## Migration Checklist

### 1. Check Your Current Keys

**In your `.env` file:**

```env
# OLD (legacy)
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# NEW (current)
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### 2. Get Your New Keys

1. Go to Supabase Dashboard → **Settings** → **API**
2. Look for **"API Keys"** section
3. You should see:
   - **publishable** key (starts with `sb_publishable_`)
   - **secret** key (starts with `sb_secret_`)
   - Legacy keys (if still available)

### 3. Update Environment Variables

**Frontend (.env):**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Backend/Server (.env):**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

### 4. Update Your Code

**Supabase Client Initialization:**

```javascript
// OLD
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY // ← OLD
);

// NEW
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY // ← NEW
);
```

**Edge Functions:**

```typescript
// Access the publishable key in your Edge Function
const publishableKey = Deno.env.get('SB_PUBLISHABLE_KEY');
```

### 5. Test Everything

- Run your development server
- Test all Supabase interactions
- Check for authentication errors
- Verify data operations work

---

## Common Issues & Solutions

### ⚠️ CRITICAL: "Verify JWT with legacy secret" Setting

**This is the #1 cause of 401 errors after migrating to new API keys!**

#### The Problem

When using the new `publishable`/`secret` API keys, your project uses **asymmetric JWT signing** (JWKS). But there's a setting that defaults to ON:

**"Verify JWT with legacy secret"**

When this is ON:

- Supabase validates JWTs using the old JWT secret
- But your project is using the new API key format
- Result: 401 "Invalid JWT" errors

#### The Fix

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Look for **"JWT Settings"** or **"Authentication"** section
3. Find **"Verify JWT with legacy secret"** toggle
4. Turn it **OFF** ❌
5. Save/Apply changes

#### How to Check if This is Your Issue

- You're using `sb_publishable_...` keys
- You get 401 errors on Edge Functions or authenticated requests
- Your user JWT looks valid (in DevTools)
- Turning OFF "Verify JWT with legacy secret" fixes it

---

### Issue 1: 401 Unauthorized with Edge Functions (Other Causes)

**Symptom:**

```
POST https://your-project.supabase.co/functions/v1/generate-story 401
```

**Cause:**

- Edge Functions might require proper authentication headers
- The `apikey` header should use the **publishable key**

**Solution:**
Ensure your Supabase client is initialized with the publishable key. The `supabase-js` library will automatically include the correct headers when calling Edge Functions:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  supabaseUrl,
  publishableKey // ← Must be the new format!
);

// When calling Edge Functions, supabase-js adds:
// - apikey: sb_publishable_...
// - authorization: Bearer eyJ... (if user is logged in)
```

### Issue 2: Mixed Key Usage

**Don't mix old and new keys:**

```javascript
// ❌ WRONG
const supabase = createClient(
  'https://your-project.supabase.co',
  'eyJhbGci...' // Old anon key
);

// ✅ CORRECT
const supabase = createClient(
  'https://your-project.supabase.co',
  'sb_publishable_...' // New publishable key
);
```

### Issue 3: Missing Environment Variables

**Always check your `.env` file:**

```bash
# Debug: Check what keys you have
echo $VITE_SUPABASE_PUBLISHABLE_KEY
# Should start with: sb_publishable_
```

---

## Quick Reference Card

### Environment Variable Names

| Old Name                    | New Name                        | Format Prefix     |
| --------------------------- | ------------------------------- | ----------------- |
| `VITE_SUPABASE_ANON_KEY`    | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY`           | `sb_secret_`      |
| `VITE_SUPABASE_KEY`         | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_` |

### What to Use Where

| Situation                     | Use Key                             |
| ----------------------------- | ----------------------------------- |
| Frontend (browser)            | **publishable** key                 |
| Backend/Node.js server        | **secret** key                      |
| Edge Functions (client calls) | **publishable** key                 |
| Edge Functions (internal)     | **secret** key (via `Deno.env.get`) |

---

## Authentication with Edge Functions

When a user is logged in, Supabase automatically includes their JWT token when calling Edge Functions:

```javascript
// If user is logged in, this works:
const { data } = await supabase.functions.invoke('my-function', {
  body: { some: 'data' },
});

// Headers sent automatically:
// Authorization: Bearer <user-jwt-token>
// apikey: sb_publishable_...
```

**In your Edge Function:**

```typescript
serve(async req => {
  // Get user from auth header (if present)
  const authHeader = req.headers.get('Authorization');

  if (authHeader) {
    // User is authenticated
    const token = authHeader.replace('Bearer ', '');
    // Verify token with Supabase if needed
  }

  // ... rest of your function
});
```

---

## For Future Agents: Debug Checklist

When encountering 401 errors with Supabase:

1. **⚠️ CHECK THIS FIRST: "Verify JWT with legacy secret" setting**
   - Dashboard → Settings → API
   - If using new API keys (`sb_publishable_`), this should be **OFF**
   - This is the #1 cause of 401 errors with new API key system!

2. **Check the API key format:**
   - Old: `eyJhbGci...` (JWT)
   - New: `sb_publishable_...` or `sb_secret_...`

3. **Verify environment variables:**

   ```bash
   # Check if variables are set
   echo $VITE_SUPABASE_PUBLISHABLE_KEY
   echo $VITE_SUPABASE_URL
   ```

4. **Check what headers are being sent:**
   - Open DevTools → Network tab
   - Find the failed request
   - Look for `apikey` and `authorization` headers
   - `apikey` should start with `sb_publishable_`
   - `authorization` should have `Bearer eyJ...` if user is logged in

5. **Check Supabase Dashboard:**
   - Settings → API → API Keys section
   - Verify the keys match what's in your `.env`

6. **Check if user is authenticated:**

   ```javascript
   const {
     data: { session },
   } = await supabase.auth.getSession();
   console.log('Session:', session);
   ```

7. **Edge Functions specific:**
   - Make sure the function is deployed
   - Check function logs in Supabase dashboard
   - Verify CORS headers include `apikey`

---

## Resources

- [Official: Introducing JWT Signing Keys](https://supabase.com/blog/jwt-signing-keys)
- [GitHub: Upcoming changes to Supabase API Keys #29260](https://github.com/orgs/supabase/discussions/29260)
- [Docs: Understanding API keys](https://supabase.com/docs/guides/api/api-keys)
- [Docs: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Changelog](https://supabase.com/changelog)

---

## FAQ

**Q: Getting 401 "Invalid JWT" errors with Edge Functions?**
A: Check the "Verify JWT with legacy secret" setting in Dashboard → Settings → API. If you're using new API keys, this should be **OFF**. This is the most common issue!

**Q: Do I need to migrate right now?**
A: No, legacy keys still work. But you should migrate before late 2026.

**Q: Can I use both old and new keys during migration?**
A: Yes, both can be active simultaneously during the transition period.

**Q: Will my existing code break?**
A: No, as long as you update the environment variables. The `supabase-js` client works with both formats.

**Q: What if I can't find my new keys?**
A: Go to Dashboard → Settings → API → Look for "API Keys" section. If you don't see new keys, your project might still be on legacy. You may need to opt-in to migrate.

**Q: Do Edge Functions require authentication?**
A: Not necessarily. You can create public Edge Functions that don't require auth. But if the user is logged in, Supabase automatically sends their JWT token.

---

Last updated: 2026-01-04
