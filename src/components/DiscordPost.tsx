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
        {status === 'done' && (
          <span className="muted" style={{ fontSize: 13 }}>
            Posted ✓
          </span>
        )}
        {status === 'error' && (
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Posting uploads this file to Discord.
      </p>
    </div>
  );
}
