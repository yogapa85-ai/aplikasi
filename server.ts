import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { io as ioClient, Socket } from 'socket.io-client';
import {
  buildOcmDateAndPath,
  readOcmRealtime,
  validateOcmDateParams,
} from './ocmZipReader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const RAW_UPSTREAM = process.env.UPSTREAM_API_URL || 'https://elm-gristle-promotion.ngrok-free.dev';

function resolveSafeUpstreamBase(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Invalid upstream protocol');
  }
  return parsed.origin;
}

const UPSTREAM_BASE = resolveSafeUpstreamBase(RAW_UPSTREAM);
const UPSTREAM_HEADERS: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
  'Accept': 'application/json',
};

interface NormalizedPerformance {
  periode: string;
  year: string;
  month: number;
  ca: string;
  collId: string;
  collName: string;
  spvId: string;
  spvName: string;
  posId: string;
  posName: string;
  bahan: number;
  rolling: number;
  inPercent: number;
}

interface QueueItem {
  phone: string;
  status: 'pending' | 'validating' | 'success' | 'failed';
  updatedAt: string;
}

interface LiveEvent {
  id: string;
  type: 'connection' | 'gateway' | 'queue' | 'completed' | 'system';
  title: string;
  detail: string;
  timestamp: string;
  tone: 'neutral' | 'success' | 'warning' | 'error';
}

function findField(obj: Record<string, unknown>, target: string): unknown {
  const normalizedTarget = target.trim().toUpperCase();
  for (const key of Object.keys(obj)) {
    if (key.trim().toUpperCase() === normalizedTarget) {
      return obj[key];
    }
  }
  return undefined;
}

function parseNumeric(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val !== 'string') return 0;
  let cleaned = val.trim().replace(/%/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '.');
  }
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function normalizePercent(val: unknown): number {
  const n = parseNumeric(val);
  if (n > -1 && n < 1 && n !== 0) {
    return Number((n * 100).toFixed(2));
  }
  return Number(n.toFixed(2));
}

function parsePeriodParts(periode: string): { year: string; month: number } {
  const parts = periode.split('/');
  if (parts.length >= 3) {
    return {
      month: parseInt(parts[1], 10) || 0,
      year: parts[2].trim(),
    };
  }
  return { month: 0, year: 'Unknown' };
}

function normalizePerformanceRow(raw: Record<string, unknown>): NormalizedPerformance {
  const periode = String(findField(raw, 'PERIODE') ?? '').trim();
  const { year, month } = parsePeriodParts(periode);
  const ca = String(findField(raw, 'CA') ?? '-').trim();
  const collId = String(findField(raw, 'COLL ID') ?? '-').trim();
  const collName = String(findField(raw, 'COLL NAME') ?? 'Tanpa Nama').trim();
  const spvId = String(findField(raw, 'SPV ID') ?? '-').trim();
  const spvName = String(findField(raw, 'SPV NAME') ?? '-').trim();
  const posId = String(findField(raw, 'POS ID') ?? '-').trim();
  const posName = String(findField(raw, 'POS NAME') ?? '-').trim();
  const bahan = parseNumeric(findField(raw, 'BAHAN'));
  const rolling = parseNumeric(findField(raw, 'ROLLING'));
  const inPercent = normalizePercent(findField(raw, 'IN%'));

  return {
    periode,
    year,
    month,
    ca,
    collId,
    collName,
    spvId,
    spvName,
    posId,
    posName,
    bahan,
    rolling,
    inPercent,
  };
}

function periodSortWeight(periode: string): number {
  const { year, month } = parsePeriodParts(periode);
  const y = parseInt(year, 10) || 0;
  return y * 100 + month;
}

async function fetchUpstreamPerformanceQuery(query: string): Promise<NormalizedPerformance[]> {
  const sanitized = query.trim() === '' ? ' ' : query.trim();
  const url = `${UPSTREAM_BASE}/api/performance/${encodeURIComponent(sanitized)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(url, {
      headers: UPSTREAM_HEADERS,
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Upstream HTTP ${resp.status}`);
    }
    const data = (await resp.json()) as { success?: boolean; allData?: Record<string, unknown>[] };
    if (!data.success || !Array.isArray(data.allData)) {
      return [];
    }
    return data.allData.map(normalizePerformanceRow);
  } finally {
    clearTimeout(timeout);
  }
}

let cachedProdRevision: string | null = null;
let cachedProdEntryScript: string | null | undefined = undefined;
let cachedDevRevCheck = { checkedAt: 0, rev: 'dev-init' };

function getProdEntryScript(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  if (cachedProdEntryScript !== undefined) return cachedProdEntryScript;
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    const html = fs.readFileSync(distIndex, 'utf-8');
    const match = html.match(/src="(\/assets\/[^"]+\.js)"/);
    cachedProdEntryScript = match ? match[1] : null;
  } else {
    cachedProdEntryScript = null;
  }
  return cachedProdEntryScript;
}

function computeLatestMtime(dirPath: string): number {
  let latest = 0;
  if (!fs.existsSync(dirPath)) return latest;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, computeLatestMtime(full));
    } else if (entry.isFile()) {
      try {
        const st = fs.statSync(full);
        latest = Math.max(latest, st.mtimeMs);
      } catch {
        // Ignore transient fs errors
      }
    }
  }
  return latest;
}

function getAppRevision(): string {
  if (process.env.NODE_ENV === 'production') {
    if (cachedProdRevision) return cachedProdRevision;
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    const hash = crypto.createHash('sha256');
    if (fs.existsSync(distIndex)) {
      hash.update(fs.readFileSync(distIndex));
    }
    hash.update(process.env.K_REVISION || '');
    cachedProdRevision = `prod-${hash.digest('hex').slice(0, 12)}`;
    return cachedProdRevision;
  }

  const now = Date.now();
  if (now - cachedDevRevCheck.checkedAt < 2000) {
    return cachedDevRevCheck.rev;
  }
  const srcMtime = computeLatestMtime(path.join(__dirname, 'src'));
  const htmlPath = path.join(__dirname, 'index.html');
  const htmlMtime = fs.existsSync(htmlPath) ? fs.statSync(htmlPath).mtimeMs : 0;
  const rev = `dev-${Math.round(Math.max(srcMtime, htmlMtime))}`;
  cachedDevRevCheck = { checkedAt: now, rev };
  return rev;
}

function computeDataSignature(
  records: NormalizedPerformance[],
  periods: string[]
): string {
  let rollingSum = 0;
  let bahanSum = 0;
  for (const r of records) {
    rollingSum += r.rolling;
    bahanSum += r.bahan;
  }
  return `${records.length}:${periods[0] || ''}:${Math.round(rollingSum)}:${Math.round(bahanSum)}`;
}

let cachedOverview: {
  fetchedAt: number;
  dataSignature: string;
  records: NormalizedPerformance[];
  periods: string[];
  years: string[];
  posList: string[];
  cycles: string[];
} | null = null;

async function fetchFullOverview(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedOverview && now - cachedOverview.fetchedAt < 10000) {
    return { ...cachedOverview, stale: false };
  }

  try {
    // Query space plus vowels in parallel so 1-word and multi-word collector names are all captured
    const queries = [' ', 'a', 'e', 'i', 'o', 'u'];
    const results = await Promise.allSettled(queries.map((q) => fetchUpstreamPerformanceQuery(q)));

    const map = new Map<string, NormalizedPerformance>();
    let anySuccess = false;
    for (const res of results) {
      if (res.status === 'fulfilled') {
        anySuccess = true;
        for (const rec of res.value) {
          const key = `${rec.periode}|${rec.ca}|${rec.collId}|${rec.collName}`;
          if (!map.has(key)) {
            map.set(key, rec);
          }
        }
      }
    }

    if (!anySuccess) {
      throw new Error('Tidak dapat menjangkau server data operasional.');
    }

    const records = Array.from(map.values()).sort((a, b) => {
      const pDiff = periodSortWeight(b.periode) - periodSortWeight(a.periode);
      if (pDiff !== 0) return pDiff;
      return a.inPercent - b.inPercent;
    });

    const periods = Array.from(new Set(records.map((r) => r.periode).filter(Boolean))).sort(
      (a, b) => periodSortWeight(b) - periodSortWeight(a)
    );
    const years = Array.from(new Set(records.map((r) => r.year).filter((y) => y && y !== 'Unknown'))).sort(
      (a, b) => Number(b) - Number(a)
    );
    const posList = Array.from(new Set(records.map((r) => r.posName).filter(Boolean))).sort();
    const cycles = Array.from(new Set(records.map((r) => r.ca).filter(Boolean))).sort();

    const dataSignature = computeDataSignature(records, periods);
    const prevSignature = cachedOverview?.dataSignature;

    cachedOverview = {
      fetchedAt: now,
      dataSignature,
      records,
      periods,
      years,
      posList,
      cycles,
    };

    if (prevSignature && prevSignature !== dataSignature) {
      broadcastDataUpdated(dataSignature, now, records.length);
    }

    return { ...cachedOverview, stale: false };
  } catch (err) {
    if (cachedOverview) {
      return { ...cachedOverview, stale: true, error: err instanceof Error ? err.message : 'Upstream error' };
    }
    throw err;
  }
}

// --- Real-Time Socket.IO to SSE Bridge ---
const queueMap = new Map<string, QueueItem>();
const eventBuffer: LiveEvent[] = [];
const sseClients = new Set<Response>();

let upstreamSocketConnected = false;
let gatewayStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
let lastEventAt: string | null = null;

function pushEvent(
  type: LiveEvent['type'],
  title: string,
  detail: string,
  tone: LiveEvent['tone']
) {
  const nowIso = new Date().toISOString();
  lastEventAt = nowIso;
  const entry: LiveEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    detail,
    timestamp: nowIso,
    tone,
  };
  eventBuffer.unshift(entry);
  if (eventBuffer.length > 40) {
    eventBuffer.length = 40;
  }
}

function buildLiveSnapshot() {
  const items = Array.from(queueMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  let pending = 0;
  let validating = 0;
  let success = 0;
  let failed = 0;
  for (const item of items) {
    if (item.status === 'pending') pending++;
    else if (item.status === 'validating') validating++;
    else if (item.status === 'success') success++;
    else if (item.status === 'failed') failed++;
  }
  return {
    upstreamSocketConnected,
    gatewayStatus,
    appRevision: getAppRevision(),
    entryScript: getProdEntryScript(),
    dataSignature: cachedOverview?.dataSignature,
    queueCounts: {
      pending,
      validating,
      success,
      failed,
      total: items.length,
    },
    queueItems: items.slice(0, 60),
    events: eventBuffer.slice(0, 30),
    lastEventAt,
  };
}

function broadcastDataUpdated(dataSignature: string, fetchedAt: number, recordCount: number) {
  const payload = `event: data_updated\ndata: ${JSON.stringify({
    appRevision: getAppRevision(),
    entryScript: getProdEntryScript(),
    dataSignature,
    fetchedAt: new Date(fetchedAt).toISOString(),
    recordCount,
  })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function broadcastLiveSnapshot(eventName = 'live_update') {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(buildLiveSnapshot())}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function startUpstreamSocketBridge(): Socket {
  const socket = ioClient(UPSTREAM_BASE, {
    transports: ['websocket', 'polling'],
    extraHeaders: {
      'ngrok-skip-browser-warning': 'true',
    },
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 15000,
  });

  socket.on('connect', () => {
    upstreamSocketConnected = true;
    pushEvent('connection', 'Stream Server Terhubung', 'Sinkronisasi real-time aktif dengan server pusat.', 'success');
    broadcastLiveSnapshot();
  });

  socket.on('disconnect', (reason) => {
    upstreamSocketConnected = false;
    pushEvent('connection', 'Stream Terputus', `Menghubungkan ulang (${reason})...`, 'warning');
    broadcastLiveSnapshot();
  });

  socket.on('connect_error', (err) => {
    upstreamSocketConnected = false;
    pushEvent('connection', 'Koneksi Stream Tertunda', err.message || 'Menunggu respons server.', 'warning');
    broadcastLiveSnapshot();
  });

  socket.on('connected', (msg: unknown) => {
    gatewayStatus = 'connected';
    pushEvent('gateway', 'Gateway Operasional Aktif', typeof msg === 'string' && msg ? msg : 'Perangkat terhubung dan siap mengirim.', 'success');
    broadcastLiveSnapshot();
  });

  socket.on('logout-status', (msg: unknown) => {
    gatewayStatus = 'disconnected';
    pushEvent('gateway', 'Gateway Terputus', typeof msg === 'string' && msg ? msg : 'Sesi perangkat logout.', 'error');
    broadcastLiveSnapshot();
  });

  socket.on('qr', () => {
    gatewayStatus = 'disconnected';
    pushEvent('gateway', 'Menunggu Pairing QR', 'Gateway meminta pemindaian QR ulang di Command Center.', 'warning');
    broadcastLiveSnapshot();
  });

  socket.on('pairing-code', () => {
    pushEvent('gateway', 'Kode Pairing Diterbitkan', 'Permintaan pairing perangkat baru terdeteksi.', 'neutral');
    broadcastLiveSnapshot();
  });

  socket.on('init-queue', (queueList: unknown) => {
    if (!Array.isArray(queueList)) return;
    queueMap.clear();
    const nowIso = new Date().toISOString();
    for (const item of queueList) {
      if (item && typeof item === 'object' && 'phone' in item) {
        const phone = String((item as { phone: unknown }).phone ?? '').trim();
        if (phone) {
          queueMap.set(phone, { phone, status: 'pending', updatedAt: nowIso });
        }
      }
    }
    pushEvent('queue', 'Antrean Baru Dimuat', `${queueMap.size} nomor masuk antrean operasional.`, 'neutral');
    broadcastLiveSnapshot();
  });

  socket.on('status', (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const raw = data as { phone?: unknown; status?: unknown };
    const phone = String(raw.phone ?? '').trim();
    const status = String(raw.status ?? 'pending').trim() as QueueItem['status'];
    if (!phone) return;
    const validStatus: QueueItem['status'] =
      status === 'validating' || status === 'success' || status === 'failed' ? status : 'pending';
    queueMap.set(phone, {
      phone,
      status: validStatus,
      updatedAt: new Date().toISOString(),
    });
    const labelMap: Record<QueueItem['status'], string> = {
      pending: 'Dalam Antrean',
      validating: 'Validasi Nomor',
      success: 'Terkirim',
      failed: 'Gagal / Tidak Valid',
    };
    const toneMap: Record<QueueItem['status'], LiveEvent['tone']> = {
      pending: 'neutral',
      validating: 'warning',
      success: 'success',
      failed: 'error',
    };
    pushEvent('queue', `${phone} · ${labelMap[validStatus]}`, `Status antrean diperbarui ke ${validStatus}.`, toneMap[validStatus]);
    broadcastLiveSnapshot();
  });

  socket.on('completed', (msg: unknown) => {
    pushEvent('completed', 'Batch Selesai', typeof msg === 'string' && msg ? msg : 'Seluruh antrean operasional selesai diproses.', 'success');
    broadcastLiveSnapshot();
    void fetchFullOverview(true).catch(() => {});
  });

  return socket;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', (_req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  startUpstreamSocketBridge();

  // Keep SSE clients alive with 20s heartbeat carrying latest revision & data signature
  setInterval(() => {
    const hb = JSON.stringify({
      ts: new Date().toISOString(),
      appRevision: getAppRevision(),
      entryScript: getProdEntryScript(),
      dataSignature: cachedOverview?.dataSignature,
    });
    for (const res of sseClients) {
      try {
        res.write(`event: heartbeat\ndata: ${hb}\n\n`);
      } catch {
        sseClients.delete(res);
      }
    }
  }, 20000);

  // Background watcher: detect new upstream data every 15s and push SSE data_updated to clients
  setInterval(() => {
    if (sseClients.size > 0) {
      void fetchFullOverview(true).catch(() => {});
    }
  }, 15000);

  // Version & Health endpoints
  app.get('/api/version', (_req: Request, res: Response) => {
    res.json({
      appRevision: getAppRevision(),
      entryScript: getProdEntryScript(),
      dataSignature: cachedOverview?.dataSignature || null,
      serverTime: new Date().toISOString(),
    });
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      appRevision: getAppRevision(),
      entryScript: getProdEntryScript(),
      upstreamSocketConnected,
      gatewayStatus,
    });
  });

  // Aggregated branch operational performance
  app.get('/api/ops/overview', async (req: Request, res: Response) => {
    try {
      const force = req.query.refresh === '1';
      const data = await fetchFullOverview(force);
      res.json({
        success: true,
        fetchedAt: new Date(data.fetchedAt).toISOString(),
        stale: data.stale,
        upstreamUrl: UPSTREAM_BASE,
        appRevision: getAppRevision(),
        entryScript: getProdEntryScript(),
        dataSignature: data.dataSignature,
        periods: data.periods,
        years: data.years,
        posList: data.posList,
        cycles: data.cycles,
        records: data.records,
        error: 'error' in data ? data.error : undefined,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        fetchedAt: new Date().toISOString(),
        stale: true,
        upstreamUrl: UPSTREAM_BASE,
        periods: [],
        years: [],
        posList: [],
        cycles: [],
        records: [],
        error: err instanceof Error ? err.message : 'Gagal mengambil data dari server pusat.',
      });
    }
  });

  // Track active OCM date requested by connected dashboard clients
  const nowInit = new Date();
  let watchedOcm = {
    year: nowInit.getFullYear(),
    month: nowInit.getMonth() + 1,
    day: nowInit.getDate(),
    prefix: 'CL',
    lastSig: null as string | null,
  };

  setInterval(() => {
    if (sseClients.size === 0) return;
    const { targetPath, date } = buildOcmDateAndPath(
      watchedOcm.year,
      watchedOcm.month,
      watchedOcm.day,
      watchedOcm.prefix
    );
    fs.promises
      .stat(targetPath)
      .then((st) => {
        const sig = `${st.mtimeMs}:${st.size}`;
        if (watchedOcm.lastSig && watchedOcm.lastSig !== sig) {
          watchedOcm.lastSig = sig;
          const payload = `event: ocm_updated\ndata: ${JSON.stringify({
            periodLabel: date.periodLabel,
            fileMtimeMs: st.mtimeMs,
            checkedAt: new Date().toISOString(),
          })}\n\n`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch {
              sseClients.delete(client);
            }
          }
        } else if (!watchedOcm.lastSig) {
          watchedOcm.lastSig = sig;
        }
      })
      .catch(() => {
        // Network path unreachable or ZIP not yet created
      });
  }, 5000);

  // Realtime OCM calculation by date & COLL_ID (direct from Drive folder / optional RPT_NETWORK_ROOT)
  app.get('/api/ops/ocm-realtime', async (req: Request, res: Response) => {
    const now = new Date();
    const rawYear = req.query.year ?? now.getFullYear();
    const rawMonth = req.query.month ?? now.getMonth() + 1;
    const rawDay = req.query.day ?? now.getDate();
    const rawPrefix = typeof req.query.prefix === 'string' ? req.query.prefix.trim() : 'CL';
    const safePrefix = /^[A-Z0-9]{1,8}$/i.test(rawPrefix) ? rawPrefix.toUpperCase() : 'CL';
    const forceDownload = req.query.force === '1';

    const validDate = validateOcmDateParams(rawYear, rawMonth, rawDay);
    if (!validDate) {
      const fallbackInfo = buildOcmDateAndPath(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
        safePrefix
      );
      res.status(400).json({
        success: false,
        status: 'error',
        date: fallbackInfo.date,
        targetPath: fallbackInfo.targetPath,
        entryName: null,
        rowCount: 0,
        collectorCount: 0,
        checkedAt: new Date().toISOString(),
        fileMtimeMs: null,
        errorMessage: 'Parameter tanggal, bulan, atau tahun tidak valid.',
        metricsByCollId: {},
      });
      return;
    }

    const result = await readOcmRealtime(
      validDate.year,
      validDate.month,
      validDate.day,
      safePrefix,
      forceDownload
    );

    watchedOcm = {
      year: validDate.year,
      month: validDate.month,
      day: validDate.day,
      prefix: safePrefix,
      lastSig: result.fileMtimeMs ? `${result.fileMtimeMs}:${result.rowCount}` : null,
    };

    res.json(result);
  });

  // Collector quick search
  app.get('/api/ops/collector/:query', async (req: Request, res: Response) => {
    const rawQuery = String(req.params.query ?? '').trim();
    if (!rawQuery || rawQuery.length > 80) {
      res.status(400).json({ success: false, message: 'Kata kunci pencarian tidak valid.' });
      return;
    }
    try {
      const records = await fetchUpstreamPerformanceQuery(rawQuery);
      records.sort((a, b) => periodSortWeight(b.periode) - periodSortWeight(a.periode));
      res.json({ success: true, records });
    } catch (err) {
      res.status(502).json({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal menghubungi server operasional.',
      });
    }
  });

  // Safe profile photo proxy (prevents ngrok warning page & CORS issues)
  app.get('/api/ops/photo/:name', async (req: Request, res: Response) => {
    const rawName = String(req.params.name ?? '').trim();
    if (!rawName || rawName.length > 100 || rawName.includes('/') || rawName.includes('..')) {
      res.status(400).end();
      return;
    }
    const cleanFile = rawName.endsWith('.jpg') ? rawName : `${rawName}.jpg`;
    const targetUrl = `${UPSTREAM_BASE}/profiles/${encodeURIComponent(cleanFile)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const upstream = await fetch(targetUrl, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: controller.signal,
      });
      if (!upstream.ok) {
        res.status(404).end();
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        res.status(404).end();
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    } catch {
      res.status(404).end();
    } finally {
      clearTimeout(timeout);
    }
  });

  // Real-time SSE stream
  app.get('/api/ops/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`event: snapshot\ndata: ${JSON.stringify(buildLiveSnapshot())}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Upstream login proxy for Incentive Portal
  app.post('/api/ops/login', async (req: Request, res: Response) => {
    const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      res.status(400).json({ success: false, message: 'User/NPK dan Password wajib diisi.' });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const upstream = await fetch(`${UPSTREAM_BASE}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ username: username.trim(), password }),
        signal: controller.signal,
      });
      const result = (await upstream.json()) as { success?: boolean; message?: string };
      res.status(upstream.status).json(result);
    } catch (err) {
      res.status(502).json({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal menghubungi server autentikasi.',
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Upstream incentive lookup proxy
  app.get('/api/ops/incentive/:npk', async (req: Request, res: Response) => {
    const npk = String(req.params.npk ?? '').trim();
    if (!npk || !/^[a-zA-Z0-9_-]{1,32}$/.test(npk)) {
      res.status(400).json({ success: false, message: 'Format NPK tidak valid.' });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const upstream = await fetch(`${UPSTREAM_BASE}/api/incentive/${encodeURIComponent(npk)}`, {
        headers: UPSTREAM_HEADERS,
        signal: controller.signal,
      });
      const result = (await upstream.json()) as {
        success?: boolean;
        message?: string;
        allData?: Record<string, unknown>[];
      };
      if (!result.success || !Array.isArray(result.allData)) {
        res.status(upstream.status).json({
          success: false,
          message: result.message || 'Data insentif tidak ditemukan.',
          records: [],
        });
        return;
      }
      const records = result.allData.map((row) => ({
        periode: String(findField(row, 'PERIODE') ?? '').trim(),
        nama: String(findField(row, 'NAMA') ?? 'Tanpa Nama').trim(),
        npk: String(findField(row, 'NPK') ?? '-').trim(),
        handlingCycle: String(findField(row, 'HANDLING_CYCLE') ?? 'C0').trim(),
        finalIncColl: parseNumeric(findField(row, 'FINAL_INC_COLL')),
      }));
      res.json({ success: true, records });
    } catch (err) {
      res.status(502).json({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal mengambil data insentif.',
        records: [],
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const noCacheFiles = new Set(['sw.js', 'registerSW.js', 'manifest.webmanifest', 'index.html']);
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (noCacheFiles.has(base) || base.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CR 41400 Field Ops server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
