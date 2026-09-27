try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on real environment variables.
}

const env = process.env;
const num = (key, fallback) => (env[key] !== undefined && env[key] !== '' ? Number(env[key]) : fallback);
const bool = (key, fallback) => (env[key] ? env[key].toLowerCase() === 'true' : fallback);

export const config = {
  port: num('PORT', 3000),
  timezone: env.TIMEZONE || 'Europe/Istanbul',

  camera: {
    url: env.CAMERA_URL || '',
    label: env.CAMERA_LABEL || 'Demo camera',
    fps: num('LIVE_FPS', 2),
    width: num('LIVE_WIDTH', 640),
  },

  motion: {
    minArea: num('MOTION_MIN_AREA', 0.015),
    maxArea: num('MOTION_MAX_AREA', 0.6),
    pixelThreshold: num('MOTION_PIXEL_THRESHOLD', 28),
    consecutive: num('MOTION_CONSECUTIVE', 2),
  },

  ai: {
    // Accept a comma-separated list (GOOGLE_AI_API_KEYS) or a single GEMINI_API_KEY.
    apiKeys: (env.GOOGLE_AI_API_KEYS || env.GEMINI_API_KEY || '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k && !/^PLACEHOLDER/i.test(k)),
    model: env.GEMINI_MODEL || env.AI_MODEL || 'gemini-3.6-flash',
    // Tried in order when the primary is overloaded (503), unavailable (404), or
    // its per-day free-tier quota is spent (429). Each model has its own quota.
    fallbackModels: (env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash,gemini-flash-latest')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    cooldownSec: num('DESCRIBE_COOLDOWN_SEC', 180),
    heartbeatMin: num('HEARTBEAT_MIN', 60),
    language: env.DESCRIPTION_LANGUAGE || 'English',
    chatContextEvents: num('CHAT_CONTEXT_EVENTS', 60),
    chatIncludeFrame: bool('CHAT_INCLUDE_FRAME', false),
    chatRateLimit: num('CHAT_RATE_LIMIT', 10),
    // Save the frame behind each event and re-analyze it for detail questions.
    frameStore: bool('FRAME_STORE', true),
    frameKeepDays: num('FRAME_KEEP_DAYS', 14), // keep frame images this many days
    frameKeep: num('FRAME_KEEP', 5000), // hard safety cap on frame count (disk protection)
    framesPerEvent: num('FRAMES_PER_EVENT', 3),
    visionRecallFrames: num('VISION_RECALL_FRAMES', 3),
    historyMaxEvents: num('HISTORY_MAX_EVENTS', 200), // max events fed to a time-window question
    mock: bool('MOCK_AI', false),
  },

  // Proactive alerts: when the camera detects one of these situations, WhatsApp
  // the frame to the alert recipients.
  alerts: {
    whatsappNumbers: (env.ALERT_WHATSAPP_NUMBERS || '')
      .split(',')
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean),
    types: (env.ALERT_TYPES || 'smoking,fire,fall,fight,weapon,medical,intrusion,emergency')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    cooldownSec: num('ALERT_COOLDOWN_SEC', 300), // per alert type, avoids spamming
    // Approved utility template, used as a fallback when the 24h service window is closed.
    templateName: env.ALERT_TEMPLATE_NAME || 'emergency_alert',
    templateLang: env.ALERT_TEMPLATE_LANG || 'tr',
  },

  contactUrl: env.CONTACT_URL || '',

  telegram: {
    token: env.TELEGRAM_BOT_TOKEN || '',
    username: (env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, ''),
  },

  whatsapp: {
    token: env.WHATSAPP_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    wabaId: env.WHATSAPP_WABA_ID || '',
    appSecret: env.WHATSAPP_APP_SECRET || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
    publicNumber: (env.WHATSAPP_PUBLIC_NUMBER || '').replace(/\D/g, ''),
    graphVersion: env.WHATSAPP_GRAPH_VERSION || 'v23.0',
    // Public HTTPS URL Meta should deliver inbound messages to. Set on every boot
    // as the WABA-level override so a stale app-level callback can't take over.
    webhookUrl: env.WHATSAPP_WEBHOOK_URL || '',
  },

  // "Watch" requests: privileged numbers can ask (in plain language) to be told
  // when a visual event happens, e.g. "minibüs gelirse haber ver".
  watch: {
    privilegedNumbers: (env.WATCH_PRIVILEGED_NUMBERS || '')
      .split(',')
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean),
    cooldownSec: num('WATCH_COOLDOWN_SEC', 600), // min seconds between two notifications for one watch
    maxActive: num('WATCH_MAX_ACTIVE', 20),
  },
};

export function formatTime(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    timeZone: config.timezone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Camera URL with credentials hidden, safe for logs. */
export function redactedCameraUrl() {
  return config.camera.url.replace(/\/\/[^@/]*@/, '//***:***@');
}
