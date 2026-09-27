import { config, formatTime } from './config.js';
import { sendImage, sendTemplate, whatsappReady } from './whatsapp.js';

// Turkish labels/emoji per alert type.
const LABELS = {
  smoking: '🚬 Sigara içiliyor',
  fire: '🔥 Yangın / duman',
  fall: '🆘 Bir kişi yere düştü',
  fight: '⚠️ Kavga / şiddet',
  weapon: '🔫 Silah görüldü',
  medical: '🆘 Tıbbi acil durum',
  intrusion: '🚷 İzinsiz giriş',
  emergency: '🚨 Acil durum',
};

const lastSentAt = new Map(); // alert type -> last dispatch time (cooldown per type)

/**
 * Send a WhatsApp alert (frame + caption) to the configured numbers for each
 * detected alert, respecting a per-type cooldown so it never spams.
 *   alerts: [{ type, detail }]
 *   jpeg:   the frame to attach
 */
export async function dispatchAlerts(alerts, jpeg) {
  if (!alerts?.length) return;
  const { whatsappNumbers, cooldownSec } = config.alerts;
  if (!whatsappNumbers.length || !whatsappReady()) return;

  const now = Date.now();
  for (const alert of alerts) {
    const type = String(alert.type).toLowerCase();
    if (now - (lastSentAt.get(type) || 0) < cooldownSec * 1000) continue; // still cooling down
    lastSentAt.set(type, now);

    const label = LABELS[type] || `🚨 ${type}`;
    const time = formatTime(now);
    const detail = alert.detail || 'Ayrıntı yok';
    const caption = `${label}\n${detail}\n📍 ${config.camera.label} · ${time}`;
    const { templateName, templateLang } = config.alerts;
    console.log(`[alert] ${type} -> ${whatsappNumbers.length} recipient(s)`);

    for (const to of whatsappNumbers) {
      try {
        // Free-form image first (rich + free within the 24h window)…
        const ok = jpeg && (await sendImage(to, jpeg, caption));
        // …fall back to the approved template so it delivers even outside the window.
        if (!ok && jpeg && templateName) {
          const sent = await sendTemplate(to, jpeg, templateName, templateLang, [label, `${detail} · ${config.camera.label} · ${time}`]);
          if (!sent) console.warn(`[alert] ${to}: both free-form and template failed (template approved yet?)`);
        }
      } catch (err) {
        console.error(`[alert] send to ${to} failed:`, err.message);
      }
    }
  }
}
