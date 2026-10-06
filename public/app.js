const $ = (id) => document.getElementById(id);

// --- i18n ---
const I18N = {
  tr: {
    title: 'Komşu — aymam.ai',
    metaDesc: 'Komşu, sıradan güvenlik kameralarını izleyen, kayıt tutan, sorularınızı yanıtlayan ve sizi uyaran bir yapay zekâ ajanına dönüştürür.',
    heroH1: 'Kameralarınıza 7/24 göz kulak olan <span class="accent">yapay zekâ</span>',
    heroP: 'Komşu, sıradan bir güvenlik kamerasını akıllı bir asistana dönüştürür — hareketi izler, gördüklerini not eder, sorularınızı yanıtlar ve belirlediğiniz durumlarda sizi uyarır.',
    tabLive: '📹 <span class="t-long">Canlı </span>Görüntü',
    tabAI: '🤖 <span class="t-long">Yapay Zekâ </span>Sohbet',
    tabLog: '📝 <span class="t-long">Son </span>Açıklamalar',
    overlayConnecting: 'Kameraya bağlanılıyor…',
    overlayOffline: 'Kamera çevrimdışı. Yeniden bağlanılıyor…',
    liveBadge: '● CANLI',
    chatGreeting: 'Merhaba! 👋 Kameranın ne gördüğünü bana sorabilirsiniz. Örneğin: “Son bir saatte ne oldu?” ya da “Şu an ortam kalabalık mı?” Şu anki durumu sormak için “şu an” veya “şimdi” diye sorun; canlı görüntüye bakarım.',
    chatPlaceholder: 'Sahne hakkında soru sorun…',
    sendBtn: 'Gönder',
    logH2: 'Komşu neler fark etti?',
    logP: 'Ortamda bir hareket olduğunda yapay zekâ sahneyi anlatır ve saatiyle buraya ekler.',
    eventsLoading: 'Yükleniyor…',
    eventsEmpty: 'Henüz bir hareket kaydedilmedi.',
    ctaH2: 'Kameralarınız da <span class="accent">bu kadar akıllı</span> olsun ister misiniz?',
    ctaP: "Komşu mevcut güvenlik kameralarınızla çalışır: hareketi izler, gördüklerini not eder, sorularınızı yanıtlar ve belirlediğiniz durumlarda sizi uyarır — web sitesinde, WhatsApp'ta ve Telegram'da. Böylece ekibinizin ekran başında beklemesine gerek kalmaz.",
    ctaBtn: "Kameralarınıza Komşu'u ekleyin",
    footer: '<strong>Komşu</strong> · bir <a href="https://aymam.ai" target="_blank" rel="noopener">aymam.ai</a> ürünü<br />Yalnızca demo amaçlıdır. Kamera görüntüsü sahibinin izniyle kullanılmaktadır. Asistan kişileri tanımlamaktan kaçınır ve plaka okumaz.',
    waTitle: "WhatsApp'tan sor",
    tgTitle: "Telegram'dan sor",
    chatError: 'Bağlantı hatası. Lütfen tekrar deneyin.',
    noAnswer: 'Yanıt alınamadı.',
    cameraCaption: 'Canlı kamera',
    chH2: "Kameranızla <span class=\"accent\">WhatsApp ve Telegram'dan</span> konuşun",
    chP: 'Uygulama yok, panel yok — kameranıza bir arkadaşınıza yazar gibi yazın.',
    c1T: 'Her şeyi sorun',
    c1P: '“Şu an ne oluyor?”, “Son bir saatte kimler geldi?” — anında yanıt alın.',
    c2T: 'Görüntüyü isteyin',
    c2P: '“Göster” yazın, kameranın o anki ya da istediğiniz saatteki karesi gelsin.',
    c3T: 'Alarm kurun',
    c3P: 'Yangın, düşme, sigara gibi durumlarda otomatik uyarı; ya da “Bugün minibüs gelirse haber ver” gibi kendi alarmınızı yazın.',
    c3N: 'Kurulumunuzda yetkili numaralara açıktır',
    waBtn: "WhatsApp'tan sor",
    tgBtn: "Telegram'dan sor",
    tryLabel: 'Hemen deneyin:',
    prompts: ['Şu an ne oluyor?', 'Son bir saatte ne oldu?', 'Şu anki görüntüyü göster'],
    locale: 'tr-TR',
  },
  en: {
    title: 'Komşu — aymam.ai',
    metaDesc: 'Komşu turns ordinary security cameras into an AI agent that watches, logs, answers questions and proactively alerts you.',
    heroH1: "AI that watches your cameras <span class=\"accent\">so your team doesn't have to</span>",
    heroP: 'Komşu turns an ordinary security camera into a smart assistant — it watches for motion, logs what it sees, answers your questions, and alerts you to the situations you choose.',
    tabLive: '📹 <span class="t-long">Live </span>Feed',
    tabAI: '🤖 <span class="t-long">AI </span>Chat',
    tabLog: '📝 <span class="t-long">Activity </span>Log',
    overlayConnecting: 'Connecting to camera…',
    overlayOffline: 'Camera offline. Reconnecting…',
    liveBadge: '● LIVE',
    chatGreeting: 'Hi there! 👋 Ask me what the camera sees — e.g. “What happened in the last hour?” or “Is it crowded right now?” For the present moment, say “now” and I’ll look at the live feed.',
    chatPlaceholder: 'Ask about the scene…',
    sendBtn: 'Send',
    logH2: 'What Komşu noticed',
    logP: 'When something moves, the AI describes the scene and logs it here with a timestamp.',
    eventsLoading: 'Loading…',
    eventsEmpty: 'No activity recorded yet.',
    ctaH2: 'Want your cameras <span class="accent">this smart</span>?',
    ctaP: 'Komşu works with your existing security cameras: it watches for motion, logs what it sees, answers your questions, and alerts you to the situations you define — on the web, WhatsApp and Telegram. So your team doesn’t have to stare at screens.',
    ctaBtn: 'Add Komşu to your cameras',
    footer: '<strong>Komşu</strong> · a product of <a href="https://aymam.ai" target="_blank" rel="noopener">aymam.ai</a><br />Demo only. Camera footage used with the owner’s permission. The assistant avoids identifying people and does not read plates.',
    waTitle: 'Ask on WhatsApp',
    tgTitle: 'Ask on Telegram',
    chatError: 'Connection error. Please try again.',
    noAnswer: 'No answer.',
    cameraCaption: 'Live camera',
    chH2: 'Talk to your cameras on <span class="accent">WhatsApp & Telegram</span>',
    chP: 'No app, no dashboard — message your camera like you’d message a colleague.',
    c1T: 'Ask anything',
    c1P: '“What’s happening right now?”, “Who came in the last hour?” — get an instant answer.',
    c2T: 'Get the picture',
    c2P: 'Type “show me” and receive the current frame — or one from any time you ask about.',
    c3T: 'Set alerts',
    c3P: 'Automatic alerts for fire, falls, smoking and more — or write your own, like “Tell me if a minibus arrives today”.',
    c3N: 'Available to authorized numbers in your installation',
    waBtn: 'Ask on WhatsApp',
    tgBtn: 'Ask on Telegram',
    tryLabel: 'Try it now:',
    prompts: ['What is happening right now?', 'What happened in the last hour?', 'Show me the camera right now'],
    locale: 'en-GB',
  },
};

let lang = (() => {
  try { const s = localStorage.getItem('lang'); if (s && I18N[s]) return s; } catch {}
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
})();
const t = (k) => (I18N[lang] && I18N[lang][k]) || k;

function applyLang(l) {
  if (I18N[l]) lang = l;
  try { localStorage.setItem('lang', lang); } catch {}
  const d = I18N[lang];
  document.documentElement.lang = lang;
  document.title = d.title;
  const md = $('metaDesc'); if (md) md.content = d.metaDesc;
  document.querySelectorAll('[data-i18n]').forEach((el) => { const v = d[el.getAttribute('data-i18n')]; if (v != null) el.textContent = v; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { const v = d[el.getAttribute('data-i18n-html')]; if (v != null) el.innerHTML = v; });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const v = d[el.getAttribute('data-i18n-ph')]; if (v != null) el.placeholder = v; });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { const v = d[el.getAttribute('data-i18n-title')]; if (v != null) el.title = v; });
  document.querySelectorAll('.lang-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  renderPrompts();
}

// Example prompts that open WhatsApp with the question pre-typed (localized).
let waBase = '';
function renderPrompts() {
  const box = $('promptChips');
  if (!box || !waBase) return;
  const prompts = t('prompts');
  $('waLink').href = `${waBase}?text=${encodeURIComponent(prompts[0])}`;
  box.innerHTML = '';
  for (const p of prompts) {
    const a = document.createElement('a');
    a.className = 'prompt-chip';
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = `${waBase}?text=${encodeURIComponent(p)}`;
    a.textContent = p;
    box.appendChild(a);
  }
  $('chPrompts').hidden = false;
}

document.querySelectorAll('.lang-toggle button').forEach((b) =>
  b.addEventListener('click', () => { applyLang(b.dataset.lang); renderEvents(lastEvents); }),
);

// --- Tabs ---
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// --- Config: channel links + labels ---
fetch('/api/config').then((r) => r.json()).then((cfg) => {
  if (cfg.whatsappUrl) {
    $('waLink').href = cfg.whatsappUrl;
    $('waLink').hidden = false;
    waBase = cfg.whatsappUrl.split('?')[0];
    renderPrompts();
  }
  if (cfg.telegramUrl) { $('tgLink').href = cfg.telegramUrl; $('tgLink').hidden = false; }
  if (cfg.contactUrl) { $('ctaLink').href = cfg.contactUrl; $('ctaLink').hidden = false; }
}).catch(() => {});

// --- Live stream ---
const stream = $('stream');
const overlay = $('videoOverlay');
let streaming = false;

function startStream() {
  streaming = true;
  stream.src = `/api/stream.mjpg?t=${Date.now()}`;
}
stream.addEventListener('load', () => {
  overlay.classList.add('hidden');
  $('liveBadge').hidden = false;
});
stream.addEventListener('error', () => {
  streaming = false;
  overlay.classList.remove('hidden');
  overlay.textContent = t('overlayOffline');
  $('liveBadge').hidden = true;
});

// --- Status ---
async function pollStatus() {
  try {
    const s = await (await fetch('/api/status')).json();
    const dot = $('statusDot');
    dot.className = 'dot ' + (s.online ? 'online' : 'offline');
    if (s.online && !streaming) startStream();
    if (!s.online) {
      overlay.classList.remove('hidden');
      overlay.textContent = t('overlayOffline');
      $('liveBadge').hidden = true;
    }
  } catch {
    $('statusDot').className = 'dot offline';
  }
}
pollStatus();
setInterval(pollStatus, 5000);

// --- Event timeline ---
let knownIds = new Set();
let firstLoad = true;
let lastEvents = [];

function renderEvents(events) {
  lastEvents = events || [];
  const ol = $('events');
  if (!lastEvents.length) { ol.innerHTML = `<li class="muted">${t('eventsEmpty')}</li>`; return; }
  ol.innerHTML = '';
  for (const e of lastEvents) {
    const li = document.createElement('li');
    li.className = e.kind === 'heartbeat' ? 'heartbeat' : '';
    if (!firstLoad && !knownIds.has(e.id)) li.classList.add('new');
    const ts = new Date(e.ts).toLocaleString(t('locale'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<time>${ts}</time><span></span>`;
    li.querySelector('span').textContent = lang === 'tr' && e.description_tr ? e.description_tr : e.description;
    ol.appendChild(li);
    knownIds.add(e.id);
  }
  firstLoad = false;
}

async function pollEvents() {
  try {
    const events = await (await fetch('/api/events?limit=60')).json();
    renderEvents(events);
  } catch {}
}

// --- Chat ---
const form = $('chatForm');
const input = $('chatInput');
const messages = $('messages');

function addMessage(text, cls) {
  const div = document.createElement('div');
  div.className = `msg ${cls}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  addMessage(q, 'user');
  input.value = '';
  $('sendBtn').disabled = true;
  const typing = addMessage('…', 'bot typing');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: q, lang }),
    });
    const data = await res.json();
    typing.remove();
    addMessage(data.answer || t('noAnswer'), 'bot');
  } catch {
    typing.remove();
    addMessage(t('chatError'), 'bot');
  } finally {
    $('sendBtn').disabled = false;
    input.focus();
  }
});

// Boot
applyLang(lang);
pollEvents();
setInterval(pollEvents, 8000);
