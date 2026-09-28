import { chat, resolveImageRequest } from './chat.js';
import { config } from './config.js';

const WELCOME = `Merhaba! Ben akıllı kamera demo botuyum 📷
Kameranın ne gördüğünü sorabilirsiniz, örn. "Son bir saatte ne oldu?" veya "Şu an kalabalık mı?"
Görüntüyü görmek için "göster" veya "şu anki kareyi gönder" yazın.`;

// Resolved bot username (from getMe), so the web page links to the real bot
// even if TELEGRAM_BOT_USERNAME is unset or wrong.
export const telegramInfo = { username: config.telegram.username || null };

// Standalone senders usable outside the polling loop (e.g. proactive watch
// notifications from the watcher). No-op when the bot isn't configured.
export function sendTelegramText(chatId, text) {
  if (!config.telegram.token) return Promise.resolve({ ok: false });
  return fetch(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: String(chatId), text }),
    signal: AbortSignal.timeout(40000),
  }).then((r) => r.json());
}

export function sendTelegramPhoto(chatId, jpeg, caption) {
  if (!config.telegram.token) return Promise.resolve({ ok: false });
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption.slice(0, 1024));
  form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'frame.jpg');
  return fetch(`https://api.telegram.org/bot${config.telegram.token}/sendPhoto`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(40000),
  }).then((r) => r.json());
}

/** Long polling: works without a public URL, so it also runs on a local PC. */
export function startTelegram(camera) {
  const { token } = config.telegram;
  if (!token) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set, bot disabled');
    return;
  }
  const api = (method, body) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000),
    }).then((r) => r.json());

  const sendPhoto = (chatId, jpeg, caption) => {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption.slice(0, 1024));
    form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'frame.jpg');
    return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(40000),
    }).then((r) => r.json());
  };

  let offset = 0;

  async function handle(message) {
    const chatId = message.chat.id;
    const text = message.text || '';
    if (!text) return api('sendMessage', { chat_id: chatId, text: 'Şu an yalnızca yazılı soruları yanıtlayabiliyorum Abi. Sorunuzu metin olarak yazar mısınız?' });
    if (text.startsWith('/start') || text.startsWith('/help')) {
      return api('sendMessage', { chat_id: chatId, text: WELCOME });
    }

    // "Show me the frame" → send the image directly (no Gemini call).
    const image = resolveImageRequest(text, camera);
    if (image) {
      api('sendChatAction', { chat_id: chatId, action: 'upload_photo' }).catch(() => {});
      const res = await sendPhoto(chatId, image.jpeg, image.caption);
      if (!res.ok) await api('sendMessage', { chat_id: chatId, text: 'Şu an gösterecek bir görüntü bulunamadı.' });
      return;
    }

    api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
    const answer = await chat(`tg:${message.from?.id ?? chatId}`, text, camera);
    return api('sendMessage', { chat_id: chatId, text: answer });
  }

  async function poll() {
    for (;;) {
      try {
        const res = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
        if (!res.ok) {
          console.error('[telegram] getUpdates failed:', res.description);
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }
        for (const update of res.result) {
          offset = update.update_id + 1;
          if (update.message) handle(update.message).catch((e) => console.error('[telegram]', e.message));
        }
      } catch (err) {
        if (err.name !== 'TimeoutError') console.error('[telegram] polling error:', err.message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  api('getMe', {})
    .then((res) => {
      if (res.ok) {
        telegramInfo.username = res.result.username;
        console.log(`[telegram] bot @${res.result.username} verified`);
      } else {
        console.error('[telegram] getMe failed:', res.description);
      }
    })
    .catch((e) => console.error('[telegram] getMe error:', e.message));

  // A webhook set earlier would block getUpdates.
  api('deleteWebhook', {}).finally(() => {
    console.log('[telegram] bot started');
    poll();
  });
}
