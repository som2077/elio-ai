# Zero Public Keys & Full-Stack Security Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely eliminate all hardcoded secrets, API keys, and Supabase JWT tokens from public git-tracked source code across the Chrome Extension and Mobile App, lock down database Row-Level Security (RLS) policies, and establish strict environment variable hygiene.

**Architecture:**

1. Client apps (Mobile & Extension) read configuration exclusively via runtime/build-time environment variables (`.env`), throwing explicit configuration errors if missing rather than falling back to hardcoded plaintext tokens.
2. Compiled extension bundles (`extension/dist/`, `extension/src/popup/popup.js`) and `.env` files are untracked from Git and enforced via `.gitignore`.
3. Supabase RLS policies are locked down so that public anonymous queries cannot dump `qr_auth_sessions` or `linked_devices`, replacing permissive table reads with single-token RPC functions.

**Tech Stack:** TypeScript, Expo 51 (React Native), Chrome Extension (Manifest V3, Vite 5), Supabase (PostgreSQL 15, RLS, PL/pgSQL).

**Spec:** Security Review checklist (`security-review/SKILL.md`) and OWASP Top 10 client secret management standards.

---

## Global Constraints

- **No Hardcoded Secrets:** Zero instances of JWT strings (`eyJ...`), API secrets, or service role keys in any tracked git file.
- **Fail-Fast Configuration:** If environment variables are absent in local development, throw clear descriptive configuration errors instead of silent fallbacks.
- **RLS Principle of Least Privilege:** `SELECT * FROM qr_auth_sessions` or `linked_devices` must NEVER be permitted for unauthenticated public roles.
- **Artifact Hygiene:** Compiled build outputs (`dist/`, minified bundles) must never be committed to Git.
- **Zero Breakage:** Mobile app and Extension pairing functionality (QR scanning, auth token exchange, video bookmarking) must continue to function seamlessly when valid `.env` variables are provided.

---

## Review Focus

1. **Leaked JWT in Git Index:** Minified bundles like `extension/src/popup/popup.js` or `extension/dist/` remaining in `git status` or git cache.
2. **Missing Env Guard:** Mobile app or Extension crashing with silent `undefined` errors when `.env` is unconfigured.
3. **QR Token Eavesdropping:** Any malicious client holding an anon key querying `qr_auth_sessions` without knowing the specific session `qr_token`.
4. **Extension Build Injections:** Vite build process failing to replace environment variable tokens in IIFE bundle outputs.
5. **Session Revocation & Cleanup:** Single-use QR auth session payloads lingering in plaintext in PostgreSQL after mobile pairing.

---

### Task 1: Database RLS & RPC Security Hardening

**Files:**

- Modify: `backend/schema.sql:100-160`

**Interfaces:**

- Consumes: PostgreSQL `qr_auth_sessions`, `linked_devices`, `saved_videos` tables.
- Produces: Strict RLS policies and secure single-use RPC function `claim_qr_session(p_qr_token uuid)`.

- [ ] **Step 1: Write SQL migration test/verification script**

Create a temporary verification query in `backend/test_rls_security.sql`:

```sql
-- Verify public anon role cannot list all QR sessions
SET ROLE anon;
SELECT count(*) FROM public.qr_auth_sessions; -- Must return 0 or error, never all rows
SELECT count(*) FROM public.linked_devices;   -- Must return 0 or error, never all rows
RESET ROLE;
```

- [ ] **Step 2: Run verification to observe current vulnerability**

Inspect current `backend/schema.sql` policies:
Notice lines 128-157 have `CREATE POLICY ... FOR SELECT TO public USING (true)` on `linked_devices` and `qr_auth_sessions`.

- [ ] **Step 3: Update `backend/schema.sql` with hardened RLS and secure RPC**

Modify `backend/schema.sql`:

1. Drop permissive `USING (true)` public read and update policies on `qr_auth_sessions` and `linked_devices`.
2. Restrict `linked_devices` strictly to authenticated owners (`auth.uid() = user_id`).
3. For `qr_auth_sessions`:
   - Public role can only `INSERT` a pending session with generated `qr_token` and `expires_at`.
   - Public role can only `SELECT` the row that matches their exact `qr_token` (e.g. `USING (qr_token = current_setting('request.headers', true)::json->>'x-qr-token' OR qr_token IS NOT NULL)`), OR even better: access via RPC function.
   - Create secure function `claim_qr_session(p_qr_token uuid)`:

     ```sql
     CREATE OR REPLACE FUNCTION public.claim_qr_session(p_qr_token uuid)
     RETURNS json
     LANGUAGE plpgsql
     SECURITY DEFINER
     AS $$
     DECLARE
       v_session record;
       v_result json;
     BEGIN
       SELECT * INTO v_session FROM public.qr_auth_sessions
       WHERE qr_token = p_qr_token AND status = 'approved' AND expires_at > now();

       IF NOT FOUND THEN
         RETURN json_build_object('status', 'not_ready');
       END IF;

       v_result := json_build_object(
         'status', 'approved',
         'auth_payload', v_session.auth_payload
       );

       -- Single-use: immediately mark as claimed so token cannot be harvested again
       UPDATE public.qr_auth_sessions
       SET status = 'claimed', auth_payload = NULL
       WHERE qr_token = p_qr_token;

       RETURN v_result;
     END;
     $$;
     ```

- [ ] **Step 4: Verify SQL syntax and policy structure**

Run: Review updated `backend/schema.sql` to confirm zero `USING (true)` policies for public select/update on sensitive tables.

- [ ] **Step 5: Commit**

```bash
git add backend/schema.sql
git commit -m "fix(security): harden Supabase RLS policies and eliminate public table dumps"
```

---

### Task 2: Mobile Security & Environment Isolation

**Files:**

- Modify: `mobile/services/supabase.ts:1-20`
- Modify: `mobile/.env.example`

**Interfaces:**

- Consumes: `process.env.EXPO_PUBLIC_SUPABASE_URL`, `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Produces: `supabase` client instance without any hardcoded credentials in source code.

- [ ] **Step 1: Write test/verification check for missing env vars**

Verify that `mobile/services/supabase.ts` throws a descriptive configuration error when environment variables are omitted, rather than falling back to an in-code key.

- [ ] **Step 2: Update `mobile/services/supabase.ts`**

Replace lines 4-13 with strict environment validation:

```typescript
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[Elio AI Security] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Please configure mobile/.env file.",
  );
}

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
```

Ensure fallback strings containing `"eyJhbGciOiJIUzI1Ni..."` and `"https://msphrcukcgfchodxhgot.supabase.co"` are completely purged.

- [ ] **Step 3: Update `mobile/.env.example`**

Ensure `mobile/.env.example` contains clear template placeholders:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

- [ ] **Step 4: Run TypeScript verification**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/services/supabase.ts mobile/.env.example
git commit -m "fix(mobile): remove hardcoded Supabase keys and enforce environment variables"
```

---

### Task 3: Extension Environment Variable Injection & Key Removal

**Files:**

- Create: `extension/.env.example`
- Create: `extension/.env` (local dev, gitignored)
- Modify: `extension/build.js`
- Modify: `extension/src/services/auth.ts:30-45`
- Modify: `extension/src/background/service_worker.ts:240-265`
- Modify: `extension/src/popup/popup.ts:80-95`

**Interfaces:**

- Consumes: `extension/.env` via Vite `define`.
- Produces: Build-time injection of `process.env.SUPABASE_URL` and `process.env.SUPABASE_ANON_KEY`.

- [ ] **Step 1: Create `extension/.env.example` and `extension/.env`**

In `extension/.env.example`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

In `extension/.env`: populate with working development credentials (and ensure it is gitignored).

- [ ] **Step 2: Update `extension/build.js` to load `.env` and inject via Vite `define`**

Read `extension/.env` using a lightweight parser in `extension/build.js`:

```javascript
import fs from "fs";
// Parse .env if exists
const envVars = {};
if (fs.existsSync(resolve(__dirname, ".env"))) {
  const envContent = fs.readFileSync(resolve(__dirname, ".env"), "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [k, ...v] = trimmed.split("=");
      envVars[k.trim()] = v.join("=").trim();
    }
  });
}
```

Pass `define` into Vite build config:

```javascript
define: {
  "process.env.SUPABASE_URL": JSON.stringify(envVars.SUPABASE_URL || process.env.SUPABASE_URL || ""),
  "process.env.SUPABASE_ANON_KEY": JSON.stringify(envVars.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""),
}
```

Also remove the dangerous line copying `dist/src/popup/popup.js` into `src/popup/popup.js`.

- [ ] **Step 3: Update `extension/src/services/auth.ts`**

Replace hardcoded `DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_ANON_KEY`:

```typescript
declare const process: {
  env: {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
  };
};

export const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || "";
export const DEFAULT_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
```

Purge any plaintext `"eyJhbGciOiJIUzI1Ni..."` strings from `extension/src/services/auth.ts`.

- [ ] **Step 4: Run extension build**

Run: `cd extension && npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add extension/build.js extension/src/services/auth.ts extension/.env.example
git commit -m "fix(extension): inject Supabase config at build-time and purge hardcoded keys"
```

---

### Task 4: Git Ignore & Tracked Artifact Sanitization

**Files:**

- Modify: `.gitignore`
- Untrack: `extension/dist/`, `extension/src/popup/popup.js`

**Interfaces:**

- Consumes: Git repository tracking state.
- Produces: Git repository free of compiled JavaScript bundles and local environment secrets.

- [ ] **Step 1: Update `.gitignore`**

Add the following entries to root `.gitignore`:

```gitignore
# Extension build outputs & secrets
extension/dist/
extension/src/popup/popup.js
extension/.env
extension/.env.*
!extension/.env.example
```

- [ ] **Step 2: Untrack compiled build files from Git cache**

Run:

```bash
git rm -r --cached extension/dist
git rm --cached extension/src/popup/popup.js
```

- [ ] **Step 3: Update `extension/manifest.json` popup path**

Ensure `extension/manifest.json` references `"default_popup": "dist/src/popup/popup.html"` for unpacked loading or keeps `"src/popup/popup.html"` while loading `dist/src/popup/popup.js` without committing compiled artifacts.

- [ ] **Step 4: Verify git status is clean of binaries and build outputs**

Run: `git status`
Expected: `extension/dist/` and `popup.js` marked as deleted from git index.

- [ ] **Step 5: Commit**

```bash
git add .gitignore extension/manifest.json
git commit -m "chore(git): untrack extension build artifacts and ignore extension .env"
```

---

### Task 5: End-to-End Secret Audit & Verification

**Files:**

- Audit all repository files.

- [ ] **Step 1: Run comprehensive secret scan regex**

Run:

```bash
grep -rnI --exclude-dir={node_modules,.git} "eyJhbGciOiJIUzI1Ni" .
```

Expected: Only present in `.env` files (which are gitignored), ZERO matches in git-tracked files.

- [ ] **Step 2: Run mobile compilation check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run extension build check**

Run: `cd extension && npm run build`
Expected: 0 errors.

- [ ] **Step 4: Document Supabase JWT Secret Rotation Guide**

Provide exact instructions for rotating the Supabase JWT secret in the Supabase Dashboard to revoke the previously committed key.

---
