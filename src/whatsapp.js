import { createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { chat, isWatchCommand, resolveImageRequest } from './chat.js';
import { config } from './config.js';

const wa = config.whatsapp;
const seen = new Set(); // Meta may deliver the same message more than once

const graph = (path) => `https://graph.facebook.com/${wa.graphVersion}/${path}`;

/**
 * Ensure the WhatsApp Business Account is subscribed to this app, so real
 * inbound messages (user -> WABA -> app) are delivered to our webhook.
 * The panel's "Test" button bypasses this, which is why sample events arrive
 * but real messages don't until this link exists.
 */
export async function subscribeWaba() {
  if (!wa.token || !wa.wabaId) {
    console.log('[whatsapp] WHATSAPP_WABA_ID not set, skipping WABA subscription');
    return;
  }
  try {
    // When a public webhook URL is configured, set it as the WABA-level override
    // so Meta delivers here regardless of the app-level callback (which may be a
    // stale/dead URL from an earlier tunnel). This makes delivery self-healing.
    const opts = { method: 'POST', headers: { authorization: `Bearer ${wa.token}` } };
    if (wa.webhookUrl) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify({ override_callback_uri: wa.webhookUrl, verify_token: wa.verifyToken });
    }
    const res = await fetch(graph(`${wa.wabaId}/subscribed_apps`), opts);
    const body = await res.text();
    console.log(`[whatsapp] subscribe WABA (${wa.webhookUrl ? 'override ' + wa.webhookUrl : 'app callback'}) -> ${res.status} ${body}`);
  } catch (err) {
    console.error('[whatsapp] subscribe WABA error:', err.message);
  }
}

export async function sendText(to, body) {
  const res = await fetch(graph(`${wa.phoneNumberId}/messages`), {
    method: 'POST',
    headers: { authorization: `Bearer ${wa.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!res.ok) console.error('[whatsapp] send failed:', res.status, await res.text());
  return res.ok;
}

/** Whether WhatsApp sending is configured (token + phone number id present). */
export const whatsappReady = () => Boolean(wa.token && wa.phoneNumberId);

/** Upload a JPEG to Meta's media store, returning the media id (or null). */
async function uploadMedia(jpeg) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'image/jpeg');
  form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'frame.jpg');
  const up = await fetch(graph(`${wa.phoneNumberId}/media`), {
    method: 'POST',
    headers: { authorization: `Bearer ${wa.token}` },
    body: form,
  });
  if (!up.ok) {
    console.error('[whatsapp] media upload failed:', up.status, await up.text());
    return null;
  }
  return (await up.json()).id;
}

/** Send a free-form image message with caption (only within the 24h service window). */
export async function sendImage(to, jpeg, caption) {
  const id = await uploadMedia(jpeg);
  if (!id) return false;
  const res = await fetch(graph(`${wa.phoneNumberId}/messages`), {
    method: 'POST',
    headers: { authorization: `Bearer ${wa.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'image', image: { id, caption: caption?.slice(0, 1024) } }),
  });
  if (!res.ok) console.error('[whatsapp] image send failed:', res.status, await res.text());
  return res.ok;
}

/**
 * Send an approved template with an image header and text body params.
 * Works regardless of the 24h window (needed for proactive alerts).
 */
export async function sendTemplate(to, jpeg, name, lang, bodyParams) {
  const id = await uploadMedia(jpeg);
  if (!id) return false;
  const res = await fetch(graph(`${wa.phoneNumberId}/messages`), {
    method: 'POST',
    headers: { authorization: `Bearer ${wa.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: lang },
        components: [
          { type: 'header', parameters: [{ type: 'image', image: { id } }] },
          { type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t).slice(0, 512) })) },
        ],
      },
    }),
  });
  if (!res.ok) console.error('[whatsapp] template send failed:', res.status, await res.text());
  return res.ok;
}

function validSignature(req) {
  if (!wa.appSecret) return false;
  const header = req.get('x-hub-signature-256') || '';
  const expected = 'sha256=' + createHmac('sha256', wa.appSecret).update(req.body).digest('hex');
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Webhook for the Meta WhatsApp Cloud API. Mount at /webhooks/whatsapp. */
export function whatsappRouter(camera) {
  const router = express.Router();

  if (!wa.token || !wa.phoneNumberId) {
    console.log('[whatsapp] credentials not set, webhook disabled');
    router.use((_req, res) => res.sendStatus(404));
    return router;
  }

  // Meta calls this once when you register the webhook URL.
  router.get('/', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === wa.verifyToken) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
  });

  router.post('/', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
    const ok = validSignature(req);
    console.log(`[whatsapp] webhook POST received (signature ${ok ? 'valid' : 'INVALID'})`);
    if (!ok) return res.sendStatus(401);
    res.sendStatus(200); // acknowledge fast, reply asynchronously

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return;
    }
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        for (const msg of change.value?.messages || []) {
          if (seen.has(msg.id)) continue;
          seen.add(msg.id);
          if (seen.size > 1000) seen.delete(seen.values().next().value);

          console.log(`[whatsapp] message from ${msg.from} (${msg.type})`);

          if (msg.type !== 'text') {
            sendText(msg.from, 'Lütfen sorunuzu metin olarak gönderin.').catch(() => {});
            continue;
          }

          // "Show me the frame" → send the image directly (no Gemini call).
          // But let a privileged operator's watch command fall through to chat().
          const priv = config.watch.privilegedNumbers.includes(msg.from);
          const image = priv && isWatchCommand(msg.text.body) ? null : resolveImageRequest(msg.text.body, camera);
          if (image) {
            sendImage(msg.from, image.jpeg, image.caption).catch((e) => console.error('[whatsapp]', e.message));
            continue;
          }

          chat(`wa:${msg.from}`, msg.text.body, camera)
            .then((text) => sendText(msg.from, text))
            .catch((e) => console.error('[whatsapp]', e.message));
        }
      }
    }
  });

  console.log('[whatsapp] webhook enabled at /webhooks/whatsapp');
  return router;
}
