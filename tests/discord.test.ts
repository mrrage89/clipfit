import { describe, it, expect } from 'vitest';
import {
  isValidWebhookUrl,
  webhookErrorMessage,
  buildWebhookForm,
} from '../src/lib/discord';

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
