# ClipFit — Post to Discord (design)

- **Date:** 2026-06-23
- **Status:** Approved (brainstorm), pending implementation plan
- **Branch:** `feat/discord-post`

## Goal

Let a user send a finished ClipFit output straight to a Discord channel in one
click, without a bot, server, OAuth, or proxy — entirely from the browser.

## Background & feasibility

- The app already has a generic **Web Share** path (`src/lib/share.ts`,
  surfaced as a "Share" button in `Result.tsx`). That covers the casual
  "share to whatever app, including Discord" case on mobile. It stays as-is.
- **Verified (2026-06-23):** Discord's webhook endpoint supports cross-origin
  browser requests. An `OPTIONS` preflight to
  `https://discord.com/api/webhooks/<id>/<token>` from origin
  `https://clipfit.pages.dev` returns `200` with
  `access-control-allow-origin: <origin>` and `access-control-allow-methods:
  POST, …`. So a pure client-side `fetch` upload to a webhook works with no
  server.
- A webhook always posts to the **one channel** it was created in. So the
  webhook feature serves users who own/admin a server (creators, communities);
  the share-sheet serves everyone else. We ship **both**.

## Scope

**In scope (v1):**
- Webhook-based "Post to Discord" on the Result screen: file + optional caption.
- One saved webhook URL (localStorage), reused across sessions.
- Keep the existing Web Share button unchanged.
- Works for *any* tool output (compress, gif, audio, convert, edit).

**Out of scope (v1):**
- Multiple saved/named webhooks.
- Custom webhook username/avatar override.
- Auto-post after a job finishes (always explicit click).
- Bot/OAuth posting to channels the user doesn't control.

## UX

A `DiscordPost` block in the Result panel, beside Download / Share.

- **No saved webhook yet:** a webhook-URL input, a one-line "Where do I get
  this? Discord → Channel → Edit → Integrations → Webhooks → New Webhook → Copy
  URL" hint, an optional caption field, and a **Post to Discord** button.
- **Saved webhook:** a compact **Post to Discord** button + optional caption +
  a small "change webhook" link that reveals the input again.
- **States:** idle → posting ("Posting…") → posted ("Posted ✓") or error (plain
  message). On first successful post the webhook URL is saved.
- **Transparency note:** a small muted line — "Posting uploads this file to
  Discord." — because every other ClipFit action is local, so this exception
  should be explicit.

## Components & interfaces

### `src/lib/discord.ts` (pure logic + thin fetch)

```ts
// Accepts discord.com / discordapp.com / ptb. / canary. and optional /vN/.
export function isValidWebhookUrl(url: string): boolean;

// Pure status -> friendly message (no network).
export function webhookErrorMessage(status: number): string;

export interface PostArgs {
  webhookUrl: string;
  blob: Blob;
  filename: string;
  mime: string;
  caption?: string;
}
export type PostResult = { ok: true } | { ok: false; message: string };

// Builds multipart FormData (files[0] + payload_json) and POSTs with ?wait=true.
export async function postToDiscordWebhook(args: PostArgs): Promise<PostResult>;

export function loadWebhook(): string | null;   // localStorage 'clipfit.discordWebhook'
export function saveWebhook(url: string): void;
```

### `src/components/DiscordPost.tsx`

Owns webhook-input + caption state and the post lifecycle; renders the two UX
states above. Calls `postToDiscordWebhook`, saves the webhook on success, and
shows posting/posted/error inline. Props: `{ result: JobResult }`.

### `src/components/Result.tsx`

Render `<DiscordPost result={result} />` alongside the existing Download/Share
buttons. No other changes.

## Data flow

1. A job completes → `Result` holds `{ blob, downloadName, mime }`.
2. User has/enters a webhook URL and optional caption, clicks Post.
3. `postToDiscordWebhook` builds `FormData`:
   - `payload_json` = `JSON.stringify({ content: caption || '' })`
   - `files[0]` = `new File([blob], filename, { type: mime })`
   - POST to `` `${webhookUrl}?wait=true` `` with **no manual `Content-Type`**
     (the browser sets the multipart boundary).
4. `2xx` → `{ ok: true }`, save webhook, show "Posted ✓".
   Non-2xx → `{ ok: false, message: webhookErrorMessage(status) }`.

## Error handling

`webhookErrorMessage` maps:
- `400` → "Discord rejected the post (bad request)."
- `401 / 403 / 404` → "That webhook is invalid or was deleted — paste a fresh URL."
- `413` → "Too large for this channel's upload limit — recompress to a smaller size."
- `429` → "Discord is rate-limiting — wait a few seconds and try again."
- `>=500` → "Discord is having problems — try again shortly."
- other / network throw → "Couldn't reach Discord — check the URL and your connection."

URL shape is validated with `isValidWebhookUrl` before any POST, so the file is
never sent to an arbitrary host.

## Persistence & security

- Single webhook URL in `localStorage` under `clipfit.discordWebhook`.
- A webhook URL is a write-secret for that channel; it lives only in the user's
  browser, is never logged, and is sent only to Discord.

## Testing

- `isValidWebhookUrl`: accepts canonical/discordapp/ptb/canary/`vN` forms;
  rejects other hosts, missing token, junk.
- `webhookErrorMessage`: each status bucket returns the expected message.
- Request construction factored so the `FormData` (fields present, filename,
  `payload_json` content) can be asserted without a network call.
- The live `fetch` is verified manually against a real test webhook.
