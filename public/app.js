const $ = (id) => document.getElementById(id);

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
  $('cameraLabel').textContent = cfg.cameraLabel || '';
  if (cfg.whatsappUrl) { $('waLink').href = cfg.whatsappUrl; $('waLink').hidden = false; }
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
  overlay.textContent = 'Kamera çevrimdışı. Yeniden bağlanılıyor…';
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
      overlay.textContent = 'Kamera çevrimdışı. Yeniden bağlanılıyor…';
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

function renderEvents(events) {
  const ol = $('events');
  if (!events.length) { ol.innerHTML = '<li class="muted">Henüz bir hareket kaydedilmedi.</li>'; return; }
  ol.innerHTML = '';
  for (const e of events) {
    const li = document.createElement('li');
    li.className = e.kind === 'heartbeat' ? 'heartbeat' : '';
    if (!firstLoad && !knownIds.has(e.id)) li.classList.add('new');
    const t = new Date(e.ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<time>${t}</time><span></span>`;
    li.querySelector('span').textContent = e.description;
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
pollEvents();
setInterval(pollEvents, 8000);

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
      body: JSON.stringify({ message: q }),
    });
    const data = await res.json();
    typing.remove();
    addMessage(data.answer || 'No answer.', 'bot');
  } catch {
    typing.remove();
    addMessage('Bağlantı hatası. Lütfen tekrar deneyin.', 'bot');
  } finally {
    $('sendBtn').disabled = false;
    input.focus();
  }
});
