import express from 'express';
import { Camera } from './camera.js';
import { chat } from './chat.js';
import { config } from './config.js';
import { recentEvents } from './db.js';
import { startTelegram, telegramInfo } from './telegram.js';
import { startWatcher } from './watcher.js';
import { subscribeWaba, whatsappRouter } from './whatsapp.js';

const camera = new Camera();
const app = express();
app.set('trust proxy', 'loopback'); // correct client IPs behind a local tunnel / reverse proxy
app.disable('x-powered-by');

// WhatsApp needs the raw body for signature checks, so mount it before express.json().
app.use('/webhooks/whatsapp', whatsappRouter(camera));
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

app.get('/api/config', (_req, res) => {
  res.json({
    cameraLabel: config.camera.label,
    contactUrl: config.contactUrl,
    telegramUrl: telegramInfo.username ? `https://t.me/${telegramInfo.username}` : null,
    whatsappUrl: config.whatsapp.publicNumber
      ? `https://wa.me/${config.whatsapp.publicNumber}?text=${encodeURIComponent('Şu an kamerada ne oluyor?')}`
      : null,
  });
});

app.get('/api/status', (_req, res) => {
  res.json({ online: camera.online, lastFrameAt: camera.latestAt || null });
});

app.get('/api/snapshot.jpg', (_req, res) => {
  if (!camera.latestJpeg) return res.sendStatus(503);
  res.set({ 'content-type': 'image/jpeg', 'cache-control': 'no-store' }).send(camera.latestJpeg);
});

const MAX_VIEWERS = 50;
let viewers = 0;

// MJPEG stream: the browser shows it in a plain <img>.
app.get('/api/stream.mjpg', (req, res) => {
  if (viewers >= MAX_VIEWERS) return res.sendStatus(503);
  viewers++;
  res.writeHead(200, {
    'content-type': 'multipart/x-mixed-replace; boundary=frame',
    'cache-control': 'no-store',
    connection: 'close',
  });
  const send = (jpg) => {
    if (res.writableLength > 2 * 1024 * 1024) return; // slow client, drop frames
    res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n\r\n`);
    res.write(jpg);
    res.write('\r\n');
  };
  if (camera.latestJpeg) send(camera.latestJpeg);
  camera.on('frame', send);
  req.on('close', () => {
    viewers--;
    camera.off('frame', send);
  });
});

app.get('/api/events', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json(recentEvents(limit));
});

app.post('/api/chat', async (req, res) => {
  const answer = await chat(`web:${req.ip}`, req.body?.message, camera, { lang: req.body?.lang });
  res.json({ answer });
});

camera.setMaxListeners(MAX_VIEWERS + 10);
camera.start();
subscribeWaba();
startWatcher(camera, () => {});
startTelegram(camera);

app.listen(config.port, () => {
  console.log(`Smart camera demo running at http://localhost:${config.port}`);
  if (!config.ai.apiKeys.length && !config.ai.mock) console.warn('[ai] no Gemini keys set: no descriptions or chat answers');
  else if (config.ai.apiKeys.length) console.log(`[ai] ${config.ai.apiKeys.length} Gemini key(s) loaded, model ${config.ai.model}`);
});
