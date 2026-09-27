import { config, formatTime } from './config.js';
import { sendTelegramPhoto } from './telegram.js';
import { deactivateWatch, markNotified } from './watches.js';
import { sendImage, sendTemplate, whatsappReady } from './whatsapp.js';

/**
 * Notify the requester for each watch the model flagged as matched, on the
 * channel they created it from. Respects a per-watch cooldown, expiry, and
 * one-shot vs recurring. Reuses the approved emergency_alert template so a
 * WhatsApp notification still lands outside the 24h service window.
 *   matches: [{ id, matched, detail }] from describeScene
 *   watches: the active watch rows passed into describeScene
 */
export async function dispatchWatchMatches(matches, watches, jpeg) {
  if (!matches?.length) return;
  const byId = new Map(watches.map((w) => [w.id, w]));
  const now = Date.now();

  for (const m of matches) {
    if (!m?.matched) continue;
    const w = byId.get(m.id);
    if (!w) continue;
    if (w.expires_at && w.expires_at <= now) { deactivateWatch(w.id); continue; }
    if (now - (w.last_notified_at || 0) < config.watch.cooldownSec * 1000) continue; // still cooling down

    markNotified(w.id, now);
    const time = formatTime(now);
    const detail = (m.detail || w.condition).toString();
    const caption = `🔔 İstediğin durum gerçekleşti Abi: ${w.condition}\n${detail}\n📍 ${config.camera.label} · ${time}`;
    console.log(`[watch] match #${w.id} (${w.condition}) -> ${w.channel}:${w.created_by}`);

    try {
      if (w.channel === 'tg') {
        await sendTelegramPhoto(w.created_by, jpeg, caption);
      } else {
        // WhatsApp: rich image first (free within the 24h window)…
        const ok = jpeg && whatsappReady() && (await sendImage(w.created_by, jpeg, caption));
        // …fall back to the approved template so it delivers outside the window.
        if (!ok && jpeg && config.alerts.templateName) {
          await sendTemplate(w.created_by, jpeg, config.alerts.templateName, config.alerts.templateLang, [
            `🔔 ${w.condition}`,
            `${detail} · ${config.camera.label} · ${time}`,
          ]);
        }
      }
    } catch (err) {
      console.error(`[watch] notify #${w.id} failed:`, err.message);
    }

    if (!w.recurring) deactivateWatch(w.id); // one-shot: fire once then retire
  }
}
