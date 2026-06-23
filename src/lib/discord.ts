// Post a finished file to a Discord channel via its webhook — entirely client-side
// (Discord's webhook endpoint allows cross-origin browser POSTs). No bot/server.

const WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/;

export function isValidWebhookUrl(url: string): boolean {
  return WEBHOOK_RE.test(url.trim());
}

export function webhookErrorMessage(status: number): string {
  if (status === 413)
    return 'Too large for this channel’s upload limit — recompress to a smaller size.';
  if (status === 429) return 'Discord is rate-limiting — wait a few seconds and try again.';
  if (status === 401 || status === 403 || status === 404)
    return 'That webhook is invalid or was deleted — paste a fresh URL.';
  if (status === 400) return 'Discord rejected the post (bad request).';
  if (status >= 500) return 'Discord is having problems — try again shortly.';
  return 'Couldn’t post to Discord — check the URL and try again.';
}

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
