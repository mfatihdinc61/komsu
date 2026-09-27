import { AiUnavailableError, answerQuestion, parseWatch } from './ai.js';
import { config, formatTime } from './config.js';
import { eventsBetween, recentEvents } from './db.js';
import { loadFrames, loadPrimaryFrame } from './frames.js';
import { activeCount, createWatch, deactivateAll, deactivateWatch, endOfTodayMs, watchesByUser } from './watches.js';

const DAY = 86400000;
const HOUR = 3600000;

/**
 * Detect a time reference in the question and return the window to search,
 * so "geçen hafta ne oldu?" pulls that period from the whole history instead
 * of only the last few events. Rolling windows (no timezone math needed).
 */
function parseTimeWindow(q) {
  const s = q.toLocaleLowerCase('tr');
  let m;
  if ((m = /(\d+)\s*saat/.exec(s))) return { start: Date.now() - +m[1] * HOUR, end: Date.now(), label: `son ${m[1]} saat` };
  if ((m = /(\d+)\s*hafta/.exec(s))) return { start: Date.now() - +m[1] * 7 * DAY, end: Date.now(), label: `son ${m[1]} hafta` };
  if ((m = /(\d+)\s*g[üu]n/.exec(s))) return { start: Date.now() - +m[1] * DAY, end: Date.now(), label: `son ${m[1]} gün` };
  if (/ge[çc]en\s*hafta|bu\s*hafta|geçen\s*7|son\s*hafta|\bhafta\b|last\s*week|past\s*week/.test(s)) return { start: Date.now() - 7 * DAY, end: Date.now(), label: 'son 1 hafta' };
  if (/d[üu]n\b|yesterday/.test(s)) return { start: Date.now() - 2 * DAY, end: Date.now() - DAY, label: 'dün' };
  if (/bug[üu]n|today/.test(s)) return { start: Date.now() - DAY, end: Date.now(), label: 'bugün' };
  if (/ge[çc]en\s*ay|bu\s*ay|son\s*ay|last\s*month/.test(s)) return { start: Date.now() - 30 * DAY, end: Date.now(), label: 'son 1 ay' };
  return null;
}

const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map(); // userKey -> timestamps

// Questions about the present tense get the live frame attached so Gemini
// answers from what the camera sees right now, not just the log.
const NOW_RE = /(şu\s*an|şuan|şimdi|hemen|an itibariyle|şu anda|currently|right now|\bnow\b|at the moment|live)/i;

// Detail questions ask about things the text log usually doesn't capture, so we
// re-analyze the saved frames of recent events. (Turkish + English cues.)
const DETAIL_RE = new RegExp(
  [
    'reng', 'renk', 'colou?r', // colour
    'giy', 'mont', 'ceket', 'kıyafet', 'kaz[aığ]', 'şapka', 'gömlek', 'pantol', 'tişört', 'çanta', 'ayakkab',
    'wear', 'coat', 'jacket', 'cloth', 'hat', 'shirt', 'bag', 'shoe',
    'kaç\\s', 'how many', 'how much', 'sayı', 'adet', // count
    '\\bkim\\b', '\\bwho\\b', 'hangi', 'which', 'ne tür', 'what kind', 'nasıl görün', 'what did', 'what does', 'neye benz', 'look like',
    'marka', 'model', 'brand', 'araç', 'arac', 'köpek', 'kedi', 'hayvan', 'dog', 'cat', 'animal', 'bisiklet', 'motor', 'bike', 'truck', 'kamyon',
  ].join('|'),
  'i',
);

function rateLimited(userKey) {
  const now = Date.now();
  const list = (hits.get(userKey) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= config.ai.chatRateLimit) {
    hits.set(userKey, list);
    return true;
  }
  list.push(now);
  hits.set(userKey, list);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(key);
}, WINDOW_MS).unref();

/**
 * Shared chat entry point for the web page, Telegram and WhatsApp.
 * userKey identifies the sender for rate limiting (e.g. "web:1.2.3.4", "tg:123").
 */
export async function chat(userKey, question, camera) {
  const q = String(question || '').trim().slice(0, 500);
  if (!q) return 'Please type a question about the camera.';
  if (rateLimited(userKey)) return 'You have asked a lot of questions. Please try again in a few minutes.';

  const [channel, senderId] = String(userKey).split(':');
  const isPrivileged = channel === 'wa' && config.watch.privilegedNumbers.includes(senderId);

  try {
    // Privileged operators can set/list/cancel standing "watch" requests in plain
    // language. If this message is one, handle it and return; otherwise fall through.
    if (isPrivileged) {
      const watchReply = await handleWatchCommand(senderId, channel, q);
      if (watchReply) return watchReply;
    }

    // If the question names a period (bugün, dün, geçen hafta, son 3 gün…), pull
    // that window from the full history; otherwise use the most recent events.
    const window = parseTimeWindow(q);
    const events = window
      ? eventsBetween(window.start, window.end, config.ai.historyMaxEvents)
      : recentEvents(config.ai.chatContextEvents);
    const wantsNow = NOW_RE.test(q);
    const liveJpeg = (wantsNow || config.ai.chatIncludeFrame) && camera.online ? camera.latestJpeg : null;

    // For detail questions (and not a live "now" question), pull the saved frames
    // of the most recent events so Gemini can re-analyze them for the specifics.
    let recallFrames = [];
    if (!wantsNow && DETAIL_RE.test(q)) {
      // Prefer several frames of the most recent events (temporal coverage of
      // the moving subject), up to the recall budget.
      for (const e of events) {
        for (const jpeg of loadFrames(e.id)) {
          recallFrames.push({ ts: e.ts, jpeg });
          if (recallFrames.length >= config.ai.visionRecallFrames) break;
        }
        if (recallFrames.length >= config.ai.visionRecallFrames) break;
      }
    }

    const answer = await answerQuestion(q, events, { liveJpeg, recallFrames });
    return answer || 'Bunu tam yanıtlayamadım Abi, biraz daha açık sorabilir misin?';
  } catch (err) {
    if (err instanceof AiUnavailableError) return 'Şu an biraz yoğunum Abi, bir dakika sonra tekrar sorar mısın? 🙏';
    console.error('[chat] error:', err);
    return 'Bir aksilik oldu Abi, lütfen birazdan tekrar dene.';
  }
}

// --- Standing "watch" requests (privileged operators only) ---
// A notify verb signals a possible watch; parseWatch() is the real authority
// (robust to any Turkish conditional phrasing like "…gelirse/…oynarsa/…girince").
const WATCH_NOTIFY_RE = /(haber ver|haberdar|bildir|bilgilendir|uyar|haber et|haber yolla|haber gönder)/i;
const WATCH_LIST_RE = /(uyarılar[ıi]m|aktif uyar|izlemeler|neleri izl|watch.*list|uyarı listesi|listem)/i;
const WATCH_CANCEL_RE = /(iptal|kald[ıi]r|durdur|vazge[çc]|\bsil\b)/i;

/** Regex-only check (no API) that a message is a watch create/list/cancel command. */
export function isWatchCommand(q) {
  const s = String(q || '');
  return (
    WATCH_NOTIFY_RE.test(s) ||
    WATCH_LIST_RE.test(s) ||
    (WATCH_CANCEL_RE.test(s) && /uyar|izle|takip/i.test(s))
  );
}

/** End-of-today by default; honour "N saat", "yarın" or "süresiz". */
function computeExpiry(expiry, hours) {
  switch (expiry) {
    case 'none': return null;
    case 'hours': return hours > 0 ? Date.now() + hours * 3600000 : endOfTodayMs();
    case 'tomorrow': return endOfTodayMs() + 86400000;
    default: return endOfTodayMs(); // today / tonight / unspecified
  }
}

/**
 * If the privileged operator's message is a watch command (create/list/cancel),
 * handle it and return the Turkish reply; otherwise return null to fall through
 * to normal Q&A. Only the create path costs an API call (parseWatch).
 */
async function handleWatchCommand(createdBy, channel, q) {
  const list = watchesByUser(createdBy);

  // LIST
  if (WATCH_LIST_RE.test(q) && !WATCH_CANCEL_RE.test(q)) {
    if (!list.length) return 'Abi, şu an aktif bir uyarın yok. Örneğin "minibüs gelirse haber ver" yazabilirsin.';
    const lines = list.map((w, i) => `${i + 1}. ${w.condition}${w.expires_at ? '' : ' (süresiz)'}`);
    return `Abi, aktif uyarıların:\n${lines.join('\n')}\n\nKaldırmak için "1. uyarıyı iptal et" ya da hepsi için "tüm uyarıları iptal et".`;
  }

  // CANCEL
  if (WATCH_CANCEL_RE.test(q) && (list.length || /uyar|izle|takip/i.test(q))) {
    if (/hepsi|tüm[uü]?|tamam[ıi]|bütün/i.test(q)) {
      const n = deactivateAll(createdBy);
      return n ? `Abi, ${n} uyarının hepsini iptal ettim. 👍` : 'Abi, iptal edilecek aktif uyarı yok.';
    }
    const m = /(\d+)/.exec(q);
    if (m && list.length) {
      const target = list[Number(m[1]) - 1];
      if (target) { deactivateWatch(target.id, createdBy); return `Abi, "${target.condition}" uyarısını iptal ettim. 👍`; }
      return `Abi, ${m[1]} numaralı uyarı yok. "uyarılarım" yazarak listeyi görebilirsin.`;
    }
    if (list.length === 1) { deactivateWatch(list[0].id, createdBy); return `Abi, "${list[0].condition}" uyarısını iptal ettim. 👍`; }
    if (list.length > 1) return 'Abi, hangisini iptal edeyim? "uyarılarım" yazıp numarasını söyle ya da "tüm uyarıları iptal et".';
    return 'Abi, iptal edilecek aktif uyarı yok.';
  }

  // CREATE — notify verb present; parseWatch confirms and extracts the details.
  if (WATCH_NOTIFY_RE.test(q)) {
    if (activeCount(createdBy) >= config.watch.maxActive) {
      return `Abi, aktif uyarı sınırına (${config.watch.maxActive}) ulaştın. Birini iptal edip tekrar dener misin?`;
    }
    let parsed;
    try {
      parsed = await parseWatch(q);
    } catch {
      return 'Şu an isteğini işleyemedim Abi, birazdan tekrar dener misin?';
    }
    if (!parsed?.isWatch || !parsed.condition) return null; // not really a watch → normal chat
    const expiresAt = computeExpiry(parsed.expiry, parsed.hours);
    createWatch({
      createdBy,
      channel,
      condition: String(parsed.condition).trim(),
      rawText: q,
      expiresAt,
      recurring: parsed.recurring !== false,
    });
    return String(parsed.confirmation || '').trim() || `Tamam Abi, "${String(parsed.condition).trim()}" olduğunda haber veririm. 👍`;
  }

  return null;
}

// "Show me the frame / send the photo" — Turkish + English cues.
const SHOW_RE =
  /(göster|gördüğ|resmi|resim|resmini|fotoğraf|fotograf|foto[ğg]raf|görüntü|goruntu|kare(yi|si)?|ekran görüntüsü|show|send|see).*(photo|image|picture|frame|resim|foto|görüntü|kare)?|(göster|show)\b/i;

const TR_STOPWORDS = new Set([
  've', 'bir', 'mi', 'mı', 'mu', 'mü', 'ne', 'olan', 'olduğu', 'için', 'ile', 'gibi', 'daha', 'çok',
  'the', 'a', 'an', 'of', 'is', 'was', 'that', 'this', 'with', 'show', 'send', 'me', 'picture', 'image', 'photo',
  'göster', 'gönder', 'at', 'atar', 'mısın', 'misin', 'musun', 'resmi', 'resim', 'görüntü', 'görüntüyü', 'kare', 'kareyi', 'fotoğraf',
]);

/** Minutes-since-midnight of a timestamp in the configured timezone. */
function minutesOfDay(ts) {
  const s = new Date(ts).toLocaleTimeString('en-GB', {
    timeZone: config.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

// Parse a time reference like "14:48", "14.48" or "14:48'de" → minutes since
// midnight. The (?!\d) lets a suffix follow the minutes (14:48de) but rejects
// three-digit runs.
function parseTimeRef(q) {
  const m = /(\d{1,2})[:.](\d{2})(?!\d)/.exec(q);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Crude Turkish-friendly stem: first 4 letters, so "motosikletli" and
// "motosiklet" (both "motos…") match despite different suffixes.
const stem = (w) => w.slice(0, 4);

function words(text) {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !TR_STOPWORDS.has(w));
}

/** Event whose description best overlaps the question (by word stems), or null. */
function bestKeywordMatch(q, events) {
  const qStems = new Set(words(q).map(stem));
  if (!qStems.size) return null;
  let best = null;
  for (const e of events) {
    let score = 0;
    for (const w of words(e.description)) if (qStems.has(stem(w))) score++;
    if (score > 0 && (!best || score > best.score)) best = { e, score };
  }
  return best?.e || null;
}

/**
 * If the user is asking to SEE a frame, return the image to send:
 *   - a "now" request → the live frame
 *   - a time reference (e.g. 14:48) → the event closest to that time
 *   - otherwise → the event whose description best matches the question,
 *     falling back to the most recent event that has a stored frame
 * Returns { jpeg, caption } or null. Does NOT call Gemini (saves quota).
 */
export function resolveImageRequest(question, camera) {
  const q = String(question || '').trim();
  if (!SHOW_RE.test(q)) return null;

  const wantsNow = NOW_RE.test(q);
  const events = recentEvents(50).filter((e) => loadPrimaryFrame(e.id)); // only events with a saved frame

  if (!wantsNow && events.length) {
    let chosen = null;

    const target = parseTimeRef(q);
    if (target != null) {
      let best = null;
      for (const e of events) {
        const d = Math.abs(minutesOfDay(e.ts) - target);
        if (!best || d < best.d) best = { e, d };
      }
      if (best && best.d <= 30) chosen = best.e; // within 30 min of the asked time
    }

    if (!chosen) chosen = bestKeywordMatch(q, events);
    if (!chosen) chosen = events[0]; // most recent with a frame

    const jpeg = loadPrimaryFrame(chosen.id);
    if (jpeg) return { jpeg, caption: `${formatTime(chosen.ts)} · ${chosen.description}` };
  }

  // "now" request, or nothing stored yet → send the live frame.
  if (camera.online && camera.latestJpeg) {
    return { jpeg: camera.latestJpeg, caption: `Şu anki görüntü · ${formatTime(Date.now())}` };
  }
  return null;
}
