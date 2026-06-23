# Post to Discord — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload a finished ClipFit output to a Discord channel via a webhook, with an optional caption, entirely client-side.

**Architecture:** A pure-logic `src/lib/discord.ts` (URL validation, error mapping, FormData builder, thin `fetch`, localStorage persistence) plus a `DiscordPost` component rendered on the Result screen. The existing Web Share button is untouched.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom), Discord webhook REST API.

Spec: `docs/superpowers/specs/2026-06-23-discord-post-design.md`

---

### Task 1: Webhook URL validation

**Files:**
- Create: `src/lib/discord.ts`
- Test: `tests/discord.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { isValidWebhookUrl } from '../src/lib/discord';

describe('isValidWebhookUrl', () => {
  it('accepts canonical and variant webhook URLs', () => {
    expect(isValidWebhookUrl('https://discord.com/api/webhooks/123/abc_DEF-9')).toBe(true);
    expect(isValidWebhookUrl('https://discordapp.com/api/webhooks/123/tok')).toBe(true);
    expect(isValidWebhookUrl('https://ptb.discord.com/api/v10/webhooks/123/tok')).toBe(true);
    expect(isValidWebhookUrl('  https://canary.discord.com/api/webhooks/1/t  ')).toBe(true);
  });
  it('rejects non-webhook / wrong-host / malformed URLs', () => {
    expect(isValidWebhookUrl('https://evil.com/api/webhooks/1/t')).toBe(false);
    expect(isValidWebhookUrl('https://discord.com/api/webhooks/123')).toBe(false);
    expect(isValidWebhookUrl('http://discord.com/api/webhooks/1/t')).toBe(false);
    expect(isValidWebhookUrl('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/discord.test.ts` (module/export missing).

- [ ] **Step 3: Implement**

```ts
const WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/;

export function isValidWebhookUrl(url: string): boolean {
  return WEBHOOK_RE.test(url.trim());
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(discord): webhook URL validation"`

---

### Task 2: Error message mapping

**Files:**
- Modify: `src/lib/discord.ts`
- Test: `tests/discord.test.ts`

- [ ] **Step 1: Add failing test**

```ts
import { webhookErrorMessage } from '../src/lib/discord';

describe('webhookErrorMessage', () => {
  it('maps statuses to friendly messages', () => {
    expect(webhookErrorMessage(413)).toMatch(/too large/i);
    expect(webhookErrorMessage(429)).toMatch(/rate/i);
    expect(webhookErrorMessage(401)).toMatch(/invalid|deleted/i);
    expect(webhookErrorMessage(404)).toMatch(/invalid|deleted/i);
    expect(webhookErrorMessage(400)).toMatch(/rejected/i);
    expect(webhookErrorMessage(500)).toMatch(/problem/i);
    expect(webhookErrorMessage(418)).toMatch(/.+/);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement (append to `src/lib/discord.ts`)**

```ts
export function webhookErrorMessage(status: number): string {
  if (status === 413) return 'Too large for this channel’s upload limit — recompress to a smaller size.';
  if (status === 429) return 'Discord is rate-limiting — wait a few seconds and try again.';
  if (status === 401 || status === 403 || status === 404)
    return 'That webhook is invalid or was deleted — paste a fresh URL.';
  if (status === 400) return 'Discord rejected the post (bad request).';
  if (status >= 500) return 'Discord is having problems — try again shortly.';
  return 'Couldn’t post to Discord — check the URL and try again.';
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(discord): status error messages"`

---

### Task 3: FormData builder + post + persistence

**Files:**
- Modify: `src/lib/discord.ts`
- Test: `tests/discord.test.ts`

- [ ] **Step 1: Add failing test for the builder**

```ts
import { buildWebhookForm } from '../src/lib/discord';

describe('buildWebhookForm', () => {
  it('packs payload_json and files[0]', () => {
    const fd = buildWebhookForm({
      blob: new Blob(['x'], { type: 'video/mp4' }),
      filename: 'clip.mp4',
      mime: 'video/mp4',
      caption: 'hi',
    });
    expect(JSON.parse(fd.get('payload_json') as string).content).toBe('hi');
    const file = fd.get('files[0]') as File;
    expect(file.name).toBe('clip.mp4');
    expect(file.type).toBe('video/mp4');
  });
  it('defaults caption to empty string', () => {
    const fd = buildWebhookForm({ blob: new Blob(['x']), filename: 'a.gif', mime: 'image/gif' });
    expect(JSON.parse(fd.get('payload_json') as string).content).toBe('');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement (append to `src/lib/discord.ts`)**

```ts
export interface PostArgs {
  webhookUrl: string;
  blob: Blob;
  filename: string;
  mime: string;
  caption?: string;
}

export function buildWebhookForm(
  args: Pick<PostArgs, 'blob' | 'filename' | 'mime' | 'caption'>,
): FormData {
  const fd = new FormData();
  fd.append('payload_json', JSON.stringify({ content: args.caption ?? '' }));
  fd.append('files[0]', new File([args.blob], args.filename, { type: args.mime }), args.filename);
  return fd;
}

export type PostResult = { ok: true } | { ok: false; message: string };

export async function postToDiscordWebhook(args: PostArgs): Promise<PostResult> {
  if (!isValidWebhookUrl(args.webhookUrl))
    return { ok: false, message: 'That doesn’t look like a Discord webhook URL.' };
  try {
    const res = await fetch(`${args.webhookUrl.trim()}?wait=true`, {
      method: 'POST',
      body: buildWebhookForm(args),
    });
    return res.ok ? { ok: true } : { ok: false, message: webhookErrorMessage(res.status) };
  } catch {
    return { ok: false, message: 'Couldn’t reach Discord — check the URL and your connection.' };
  }
}

const KEY = 'clipfit.discordWebhook';
export function loadWebhook(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function saveWebhook(url: string): void {
  try {
    localStorage.setItem(KEY, url.trim());
  } catch {
    /* storage unavailable — ignore */
  }
}
```

- [ ] **Step 4: Run, expect PASS** (whole `tests/discord.test.ts`).
- [ ] **Step 5: Commit** — `git commit -am "feat(discord): form builder, post, persistence"`

---

### Task 4: DiscordPost component

**Files:**
- Create: `src/components/DiscordPost.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';
import type { JobResult } from '../types';
import { isValidWebhookUrl, postToDiscordWebhook, loadWebhook, saveWebhook } from '../lib/discord';

type Status = 'idle' | 'posting' | 'done' | 'error';

export function DiscordPost({ result }: { result: JobResult }) {
  const saved = loadWebhook();
  const [webhook, setWebhook] = useState(saved ?? '');
  const [editing, setEditing] = useState(!saved);
  const [caption, setCaption] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const valid = isValidWebhookUrl(webhook);

  async function post() {
    setStatus('posting');
    setError('');
    const r = await postToDiscordWebhook({
      webhookUrl: webhook,
      blob: result.blob,
      filename: result.downloadName,
      mime: result.mime,
      caption: caption.trim() || undefined,
    });
    if (r.ok) {
      saveWebhook(webhook);
      setEditing(false);
      setStatus('done');
    } else {
      setError(r.message);
      setStatus('error');
    }
  }

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="section-label">Post to Discord</div>
      {editing && (
        <>
          <input
            type="url"
            placeholder="https://discord.com/api/webhooks/…"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            style={{ width: '100%' }}
          />
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            In Discord: Channel → Edit → Integrations → Webhooks → New Webhook → Copy URL.
          </p>
        </>
      )}
      <input
        type="text"
        placeholder="Optional caption…"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="primary" onClick={post} disabled={!valid || status === 'posting'}>
          {status === 'posting' ? 'Posting…' : 'Post to Discord'}
        </button>
        {!editing && <button onClick={() => setEditing(true)}>Change webhook</button>}
        {status === 'done' && <span className="muted" style={{ fontSize: 13 }}>Posted ✓</span>}
        {status === 'error' && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Posting uploads this file to Discord.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — `npm run typecheck` → no errors.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(discord): DiscordPost component"`

---

### Task 5: Wire into Result

**Files:**
- Modify: `src/components/Result.tsx`

- [ ] **Step 1: Add import** (top of file, after the share import):

```tsx
import { DiscordPost } from './DiscordPost';
```

- [ ] **Step 2: Render it** — immediately before the closing `</div>` of the component (after the "Start over" button):

```tsx
      <DiscordPost result={result} />
```

- [ ] **Step 3: Gate** — `npm run typecheck && npx vitest run && npm run build` all green.
- [ ] **Step 4: Commit** — `git commit -am "feat(discord): show DiscordPost on the result screen"`

---

### Task 6: Manual verification

- [ ] Start dev server, run any job to completion.
- [ ] Create a throwaway webhook in a test Discord channel, paste the URL, add a caption, click Post.
- [ ] Confirm the file + caption appear in the channel and the UI shows "Posted ✓"; reload and confirm the webhook is remembered (compact state).
- [ ] Paste a bad URL → Post disabled; paste a deleted webhook → friendly error.
