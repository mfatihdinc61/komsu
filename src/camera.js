import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import jpeg from 'jpeg-js';
import { config, redactedCameraUrl } from './config.js';

const GRID_W = 64;
const GRID_H = 36;
const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

/**
 * Pulls frames from the camera with ffmpeg (as a JPEG stream), keeps the latest
 * frame for the live view and runs a simple frame-difference motion detector.
 *
 * Events: 'frame' (jpegBuffer), 'motion' ({ area, jpeg }), 'status' (online:boolean)
 */
export class Camera extends EventEmitter {
  latestJpeg = null;
  latestGrid = null;
  latestAt = 0;
  online = false;

  #proc = null;
  #buffer = Buffer.alloc(0);
  #prevGrid = null;
  #frameBuffer = []; // recent {ts, jpeg} for multi-frame event capture
  #motionStreak = 0;
  #retryMs = 2000;
  #stopped = false;

  /** Last n frame JPEG buffers (chronological), for saving a few frames per event. */
  recentFrames(n) {
    return this.#frameBuffer.slice(-n).map((f) => f.jpeg);
  }

  start() {
    if (!config.camera.url) {
      console.warn('[camera] CAMERA_URL is empty, camera disabled');
      return;
    }
    this.#spawn();
  }

  stop() {
    this.#stopped = true;
    this.#proc?.kill();
  }

  #spawn() {
    const { url, fps, width } = config.camera;
    const input = url.startsWith('rtsp')
      ? ['-rtsp_transport', 'tcp', '-timeout', '10000000', '-i', url]
      : ['-re', '-stream_loop', '-1', '-i', url];

    const args = [
      '-hide_banner', '-loglevel', 'error',
      ...input,
      '-an',
      '-vf', `fps=${fps},scale=${width}:-2`,
      '-c:v', 'mjpeg', '-q:v', '6',
      '-f', 'image2pipe', 'pipe:1',
    ];

    console.log(`[camera] connecting to ${redactedCameraUrl()}`);
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.#proc = proc;

    proc.stdout.on('data', (chunk) => this.#onData(chunk));
    proc.stderr.on('data', (d) => console.error('[ffmpeg]', d.toString().trim()));
    proc.on('error', (err) => console.error('[camera] failed to start ffmpeg:', err.message));
    proc.on('close', (code) => {
      this.#setOnline(false);
      this.#buffer = Buffer.alloc(0);
      this.#prevGrid = null;
      if (this.#stopped) return;
      console.warn(`[camera] ffmpeg exited (${code}), retrying in ${this.#retryMs / 1000}s`);
      setTimeout(() => this.#spawn(), this.#retryMs);
      this.#retryMs = Math.min(this.#retryMs * 2, 60000);
    });
  }

  #onData(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    // ffmpeg writes whole JPEGs back to back; split on start/end markers.
    for (;;) {
      const start = this.#buffer.indexOf(SOI);
      if (start === -1) {
        this.#buffer = Buffer.alloc(0);
        return;
      }
      const end = this.#buffer.indexOf(EOI, start + 2);
      if (end === -1) {
        if (start > 0) this.#buffer = this.#buffer.subarray(start);
        return;
      }
      const frame = Buffer.from(this.#buffer.subarray(start, end + 2));
      this.#buffer = this.#buffer.subarray(end + 2);
      this.#onFrame(frame);
    }
  }

  #onFrame(frame) {
    this.latestJpeg = frame;
    this.latestAt = Date.now();
    this.#retryMs = 2000;
    this.#setOnline(true);
    this.emit('frame', frame);

    this.#frameBuffer.push({ ts: Date.now(), jpeg: frame });
    if (this.#frameBuffer.length > 20) this.#frameBuffer.shift();

    let grid;
    try {
      grid = toGrayGrid(frame);
    } catch (err) {
      console.warn('[camera] could not decode frame:', err.message);
      return;
    }
    const prev = this.#prevGrid;
    this.#prevGrid = grid;
    this.latestGrid = grid;
    if (!prev) return;

    const { pixelThreshold, minArea, maxArea, consecutive } = config.motion;
    let changed = 0;
    for (let i = 0; i < grid.length; i++) {
      if (Math.abs(grid[i] - prev[i]) > pixelThreshold) changed++;
    }
    const area = changed / grid.length;

    if (area >= minArea && area <= maxArea) {
      this.#motionStreak++;
      if (this.#motionStreak === consecutive) this.emit('motion', { area, jpeg: frame });
    } else {
      this.#motionStreak = 0;
    }
  }

  #setOnline(online) {
    if (this.online === online) return;
    this.online = online;
    console.log(`[camera] ${online ? 'online' : 'offline'}`);
    this.emit('status', online);
  }
}

/** Fraction of grid cells that differ by more than `pixelThreshold`. */
export function gridDiff(a, b, pixelThreshold) {
  if (!a || !b || a.length !== b.length) return 1;
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > pixelThreshold) changed++;
  return changed / a.length;
}

/** Decode a JPEG and average it down to a small grayscale grid. */
function toGrayGrid(jpegBuf) {
  const { width, height, data } = jpeg.decode(jpegBuf, { useTArray: true, formatAsRGBA: false });
  const grid = new Float32Array(GRID_W * GRID_H);
  const counts = new Uint16Array(GRID_W * GRID_H);
  const step = 2; // sample every other pixel, plenty for motion
  for (let y = 0; y < height; y += step) {
    const gy = Math.min(GRID_H - 1, Math.floor((y * GRID_H) / height));
    for (let x = 0; x < width; x += step) {
      const gx = Math.min(GRID_W - 1, Math.floor((x * GRID_W) / width));
      const p = (y * width + x) * 3;
      const g = gy * GRID_W + gx;
      grid[g] += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      counts[g]++;
    }
  }
  for (let i = 0; i < grid.length; i++) grid[i] /= counts[i] || 1;
  return grid;
}
