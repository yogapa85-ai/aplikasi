import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export interface OcmCollMetrics {
  collId: string;
  collName: string;
  rolling: number;
  pkkAwTotal: number;
  inPercent: number;
  lkpRowCount: number;
  rollingRowCount: number;
}

export type OcmRealtimeStatus =
  | 'ok'
  | 'permission_required'
  | 'unreachable'
  | 'zip_not_found'
  | 'txt_not_found'
  | 'invalid_columns'
  | 'error';

export interface OcmDateInfo {
  year: number;
  month: number;
  day: number;
  yyyymm: string;
  ddMinus1: string;
  yyyymmdd: string;
  periodLabel: string;
}

export interface OcmRealtimeResult {
  success: boolean;
  status: OcmRealtimeStatus;
  date: OcmDateInfo;
  targetPath: string;
  entryName: string | null;
  rowCount: number;
  collectorCount: number;
  checkedAt: string;
  fileMtimeMs: number | null;
  fileSizeBytes?: number | null;
  fromCache?: boolean;
  availableFiles?: string[];
  availableCycles?: string[];
  errorMessage?: string;
  metricsByCollId: Record<string, OcmCollMetrics>;
  metricsByCycle?: Record<string, Record<string, OcmCollMetrics>>;
}

const DEFAULT_NETWORK_ROOT = '\\\\Fifgroup-report\\app\\ADHOC\\qa\\RPT_REG_OPERATION';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function validateOcmDateParams(
  rawYear: unknown,
  rawMonth: unknown,
  rawDay: unknown
): { year: number; month: number; day: number } | null {
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function buildOcmDateAndPath(
  year: number,
  month: number,
  day: number,
  periodPrefix = 'CL'
): { date: OcmDateInfo; targetPath: string; networkRoot: string; fileName: string } {
  const safePrefix = /^[A-Z0-9]{1,8}$/i.test(periodPrefix.trim())
    ? periodPrefix.trim().toUpperCase()
    : 'CL';

  const yyyymm = `${year}${pad2(month)}`;
  const yyyymmdd = `${year}${pad2(month)}${pad2(day)}`;
  const ddMinus1Num =
    day > 1 ? day - 1 : new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const ddMinus1 = pad2(ddMinus1Num);
  const periodLabel = `${safePrefix}/${pad2(month)}/${year}`;

  const envRoot = (process.env.RPT_NETWORK_ROOT || '').trim();
  const networkRoot = (envRoot || DEFAULT_NETWORK_ROOT).replace(/[\\/]+$/, '');
  const sep =
    networkRoot.startsWith('\\\\') || networkRoot.includes('\\')
      ? '\\'
      : path.posix.sep;

  const fileName = `Regional_Operation_OCM_${yyyymm}_${yyyymmdd}_41400.zip`;
  const targetPath = [networkRoot, yyyymm, ddMinus1, 'REGION_3', fileName].join(sep);

  return {
    date: {
      year,
      month,
      day,
      yyyymm,
      ddMinus1,
      yyyymmdd,
      periodLabel,
    },
    targetPath,
    networkRoot,
    fileName,
  };
}

export function parseOcmNumeric(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw !== 'string') return 0;
  let cleaned = raw.trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, '');
  if (!cleaned || cleaned === '-') return 0;

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  } else {
    cleaned = cleaned.replace(/,/g, '.');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortCycleLabels(cycles: string[]): string[] {
  return [...cycles].sort((a, b) => {
    const ma = a.match(/^C(\d+)$/i);
    const mb = b.match(/^C(\d+)$/i);
    if (ma && mb) return Number(ma[1]) - Number(mb[1]);
    if (ma) return -1;
    if (mb) return 1;
    return a.localeCompare(b);
  });
}

export function parseOcmDollarDelimitedText(textContent: string): {
  status: 'ok' | 'invalid_columns';
  missingColumns?: string[];
  rowCount: number;
  availableCycles: string[];
  metricsByCollId: Record<string, OcmCollMetrics>;
  metricsByCycle: Record<string, Record<string, OcmCollMetrics>>;
} {
  const cleanText = textContent.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/);

  let headerIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || !trimmed.includes('$')) continue;
    headers = lines[i].split('$').map((col) => col.trim().toUpperCase());
    headerIdx = i;
    break;
  }

  const requiredCols = ['COLL_ID', 'LKP_TYPE', 'AKTUAL', 'PKK_AK', 'PKK_AW'] as const;
  if (headerIdx === -1) {
    return {
      status: 'invalid_columns',
      missingColumns: [...requiredCols],
      rowCount: 0,
      availableCycles: [],
      metricsByCollId: {},
      metricsByCycle: {},
    };
  }

  const colIndex = {
    COLL_ID: headers.indexOf('COLL_ID'),
    COLL_NAME: headers.indexOf('COLL_NAME'),
    CYCLE_AWAL: headers.indexOf('CYCLE_AWAL'),
    LKP_TYPE: headers.indexOf('LKP_TYPE'),
    AKTUAL: headers.indexOf('AKTUAL'),
    PKK_AK: headers.indexOf('PKK_AK'),
    PKK_AW: headers.indexOf('PKK_AW'),
  };

  const missingColumns = requiredCols.filter((c) => colIndex[c] === -1);
  if (missingColumns.length > 0) {
    return {
      status: 'invalid_columns',
      missingColumns,
      rowCount: 0,
      availableCycles: [],
      metricsByCollId: {},
      metricsByCycle: {},
    };
  }

  interface AggAcc {
    collId: string;
    collName: string;
    rolling: number;
    pkkAwTotal: number;
    lkpRowCount: number;
    rollingRowCount: number;
  }

  const agg = new Map<string, AggAcc>();
  const aggByCycle = new Map<string, Map<string, AggAcc>>();

  let rowCount = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || !rawLine.trim()) continue;
    const cols = rawLine.split('$');
    const collIdRaw = (cols[colIndex.COLL_ID] ?? '').trim();
    if (!collIdRaw) continue;

    rowCount++;
    const lkpType = (cols[colIndex.LKP_TYPE] ?? '').trim().toUpperCase();
    if (lkpType !== 'LKP') continue;

    const collNameRaw =
      colIndex.COLL_NAME !== -1 ? (cols[colIndex.COLL_NAME] ?? '').trim() : '';
    const cycleAwalRaw =
      colIndex.CYCLE_AWAL !== -1 ? (cols[colIndex.CYCLE_AWAL] ?? '').trim().toUpperCase() : '';
    const aktual = (cols[colIndex.AKTUAL] ?? '').trim().toUpperCase();
    const pkkAk = parseOcmNumeric(cols[colIndex.PKK_AK]);
    const pkkAw = parseOcmNumeric(cols[colIndex.PKK_AW]);

    const key = collIdRaw.toUpperCase();
    const cur = agg.get(key) ?? {
      collId: collIdRaw,
      collName: collNameRaw,
      rolling: 0,
      pkkAwTotal: 0,
      lkpRowCount: 0,
      rollingRowCount: 0,
    };
    if (!cur.collName && collNameRaw) cur.collName = collNameRaw;
    cur.lkpRowCount += 1;
    cur.pkkAwTotal += pkkAw;
    if (aktual === 'ROLLING') {
      cur.rolling += pkkAk;
      cur.rollingRowCount += 1;
    }
    agg.set(key, cur);

    if (cycleAwalRaw) {
      let cycleMap = aggByCycle.get(cycleAwalRaw);
      if (!cycleMap) {
        cycleMap = new Map<string, AggAcc>();
        aggByCycle.set(cycleAwalRaw, cycleMap);
      }
      const cCur = cycleMap.get(key) ?? {
        collId: collIdRaw,
        collName: cur.collName || collNameRaw,
        rolling: 0,
        pkkAwTotal: 0,
        lkpRowCount: 0,
        rollingRowCount: 0,
      };
      if (!cCur.collName && (collNameRaw || cur.collName)) {
        cCur.collName = collNameRaw || cur.collName;
      }
      cCur.lkpRowCount += 1;
      cCur.pkkAwTotal += pkkAw;
      if (aktual === 'ROLLING') {
        cCur.rolling += pkkAk;
        cCur.rollingRowCount += 1;
      }
      cycleMap.set(key, cCur);
    }
  }

  const toMetricsRecord = (sourceMap: Map<string, AggAcc>): Record<string, OcmCollMetrics> => {
    const out: Record<string, OcmCollMetrics> = {};
    for (const [key, item] of sourceMap.entries()) {
      const inPercent =
        item.pkkAwTotal > 0 ? Number(((item.rolling / item.pkkAwTotal) * 100).toFixed(2)) : 0;
      out[key] = {
        collId: item.collId,
        collName: item.collName || '-',
        rolling: item.rolling,
        pkkAwTotal: item.pkkAwTotal,
        inPercent,
        lkpRowCount: item.lkpRowCount,
        rollingRowCount: item.rollingRowCount,
      };
    }
    return out;
  };

  const metricsByCollId = toMetricsRecord(agg);
  const availableCycles = sortCycleLabels(Array.from(aggByCycle.keys()));
  const metricsByCycle: Record<string, Record<string, OcmCollMetrics>> = {};
  for (const cy of availableCycles) {
    const cMap = aggByCycle.get(cy);
    if (cMap) {
      metricsByCycle[cy] = toMetricsRecord(cMap);
    }
  }

  return {
    status: 'ok',
    rowCount,
    availableCycles,
    metricsByCollId,
    metricsByCycle,
  };
}

export async function readOcmRealtimeZip(
  year: number,
  month: number,
  day: number,
  periodPrefix = 'CL'
): Promise<OcmRealtimeResult> {
  const checkedAt = new Date().toISOString();
  const { date, targetPath, networkRoot, fileName } = buildOcmDateAndPath(
    year,
    month,
    day,
    periodPrefix
  );

  // Verify strict filename contract before touching filesystem
  if (!/^Regional_Operation_OCM_\d{6}_\d{8}_41400\.zip$/.test(fileName)) {
    return {
      success: false,
      status: 'error',
      date,
      targetPath,
      entryName: null,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      errorMessage: 'Format nama file target tidak valid.',
      metricsByCollId: {},
    };
  }

  // Step 1: Verify network root reachability
  try {
    await fs.promises.stat(networkRoot);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code || '';
    const detail =
      process.platform !== 'win32' && networkRoot.startsWith('\\\\')
        ? 'Host server berjalan di Linux tanpa mount UNC Windows. Jalankan backend di jaringan Windows kantor atau atur RPT_NETWORK_ROOT.'
        : `Kode sistem: ${code || 'UNREACHABLE'}. Pastikan akses ke share jaringan kantor aktif.`;
    return {
      success: false,
      status: 'unreachable',
      date,
      targetPath,
      entryName: null,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      errorMessage: `Path jaringan kantor (${networkRoot}) tidak terjangkau. ${detail}`,
      metricsByCollId: {},
    };
  }

  // Step 2: Verify target ZIP file existence and read it
  let fileStat: fs.Stats;
  try {
    fileStat = await fs.promises.stat(targetPath);
  } catch {
    return {
      success: false,
      status: 'zip_not_found',
      date,
      targetPath,
      entryName: null,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      errorMessage: `File ZIP belum tersedia untuk tanggal ${pad2(day)}/${pad2(month)}/${year} (${fileName}).`,
      metricsByCollId: {},
    };
  }

  try {
    const buffer = await fs.promises.readFile(targetPath);
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const txtEntries = entries.filter((e) => e.entryName.toLowerCase().endsWith('.txt'));

    const chosenEntry =
      txtEntries.find((e) => e.entryName.toUpperCase().includes('41400')) ||
      txtEntries.find((e) => e.entryName.toUpperCase().includes('OCM')) ||
      txtEntries[0];

    if (!chosenEntry) {
      return {
        success: false,
        status: 'txt_not_found',
        date,
        targetPath,
        entryName: null,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: fileStat.mtimeMs,
        errorMessage: `File teks (.txt) tidak ditemukan di dalam arsip ${fileName}.`,
        metricsByCollId: {},
      };
    }

    const rawText = chosenEntry.getData().toString('utf8');
    const parsed = parseOcmDollarDelimitedText(rawText);

    if (parsed.status === 'invalid_columns') {
      return {
        success: false,
        status: 'invalid_columns',
        date,
        targetPath,
        entryName: chosenEntry.entryName,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: fileStat.mtimeMs,
        errorMessage: `Kolom wajib (${parsed.missingColumns?.join(', ')}) tidak ditemukan pada header file ${chosenEntry.entryName}.`,
        metricsByCollId: {},
      };
    }

    const collectorCount = Object.keys(parsed.metricsByCollId).length;
    return {
      success: true,
      status: 'ok',
      date,
      targetPath,
      entryName: chosenEntry.entryName,
      rowCount: parsed.rowCount,
      collectorCount,
      checkedAt,
      fileMtimeMs: fileStat.mtimeMs,
      fileSizeBytes: fileStat.size,
      availableCycles: parsed.availableCycles,
      metricsByCollId: parsed.metricsByCollId,
      metricsByCycle: parsed.metricsByCycle,
    };
  } catch (err) {
    return {
      success: false,
      status: 'error',
      date,
      targetPath,
      entryName: null,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: fileStat.mtimeMs,
      errorMessage:
        err instanceof Error
          ? `Gagal membaca atau mengekstrak arsip ZIP: ${err.message}`
          : 'Gagal membaca atau mengekstrak arsip ZIP.',
      metricsByCollId: {},
    };
  }
}

export const DEFAULT_OCM_DRIVE_FOLDER_ID = '1xyEZTkpJHmoNb3wR7QYBvmlUcs3OsHj2';

interface PublicDriveEntry {
  id: string;
  name: string;
  isFolder: boolean;
  modifiedHint: string;
}

interface CachedPublicDriveParse {
  cachedAt: number;
  entryName: string;
  rowCount: number;
  collectorCount: number;
  fileSizeBytes: number | null;
  availableCycles: string[];
  metricsByCollId: Record<string, OcmCollMetrics>;
  metricsByCycle: Record<string, Record<string, OcmCollMetrics>>;
}

const DRIVE_CACHE_MAX = 10;
const DRIVE_CACHE_TTL_MS = 45_000;
const FOLDER_LIST_TTL_MS = 15_000;
const publicDriveCache = new Map<string, CachedPublicDriveParse>();
const folderListCache = new Map<string, { cachedAt: number; entries: PublicDriveEntry[] }>();
const inFlightPublicOcm = new Map<string, Promise<OcmRealtimeResult>>();

function setPublicDriveCache(key: string, val: CachedPublicDriveParse) {
  if (publicDriveCache.has(key)) publicDriveCache.delete(key);
  publicDriveCache.set(key, val);
  if (publicDriveCache.size > DRIVE_CACHE_MAX) {
    const oldest = publicDriveCache.keys().next().value;
    if (oldest) publicDriveCache.delete(oldest);
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function parseEmbeddedFolderHtml(html: string): PublicDriveEntry[] {
  const entries: PublicDriveEntry[] = [];
  const seenIds = new Set<string>();

  const chunks = html.split(/id="entry-([a-zA-Z0-9_-]{10,64})"/g);
  for (let i = 1; i < chunks.length; i += 2) {
    const id = chunks[i];
    const body = chunks[i + 1] || '';
    const titleMatch = body.match(/class="flip-entry-title"[^>]*>([^<]+)</);
    if (!titleMatch) continue;
    const name = decodeHtmlEntities(titleMatch[1]);
    if (!name || seenIds.has(id)) continue;
    const isFolder = body.includes('/drive/folders/') || body.includes('folder_');
    const modMatch = body.match(
      /class="flip-entry-last-modified"[^>]*>(?:\s*<div[^>]*>)?([^<]+)/
    );
    const modifiedHint = modMatch ? decodeHtmlEntities(modMatch[1]) : '';
    seenIds.add(id);
    entries.push({ id, name, isFolder, modifiedHint });
  }

  return entries;
}

async function listPublicDriveFolder(
  folderId: string,
  timeoutMs = 12000,
  bypassCache = false
): Promise<
  | { ok: true; entries: PublicDriveEntry[] }
  | { ok: false; permissionRequired: boolean; message: string }
> {
  if (!bypassCache) {
    const cachedList = folderListCache.get(folderId);
    if (cachedList && Date.now() - cachedList.cachedAt < FOLDER_LIST_TTL_MS) {
      return { ok: true, entries: cachedList.entries };
    }
  }

  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (
      resp.url.includes('accounts.google.com') ||
      resp.status === 401 ||
      resp.status === 403
    ) {
      return {
        ok: false,
        permissionRequired: true,
        message: `Folder Google Drive (${folderId}) masih berstatus Dibatasi atau sedang memproses izin bagikan. Pastikan akses = "Siapa saja yang memiliki link (Pelihat)" lalu klik Sinkronkan OCM.`,
      };
    }

    if (!resp.ok) {
      return {
        ok: false,
        permissionRequired: false,
        message: `Gagal membuka folder Google Drive (HTTP ${resp.status}).`,
      };
    }

    const html = await resp.text();
    const entries = parseEmbeddedFolderHtml(html);

    if (entries.length > 0 || html.includes('class="flip-entries"')) {
      folderListCache.set(folderId, { cachedAt: Date.now(), entries });
      return { ok: true, entries };
    }

    if (
      html.includes('accounts.google.com/ServiceLogin') ||
      html.includes('name="identifier"') ||
      html.includes('show-storage-access')
    ) {
      return {
        ok: false,
        permissionRequired: true,
        message: `Folder Google Drive (${folderId}) masih berstatus Dibatasi atau sedang memproses izin bagikan. Pastikan akses = "Siapa saja yang memiliki link (Pelihat)" lalu klik Sinkronkan OCM.`,
      };
    }

    return { ok: true, entries };
  } catch (err) {
    return {
      ok: false,
      permissionRequired: false,
      message:
        err instanceof Error
          ? `Tidak dapat menghubungi Google Drive: ${err.message}`
          : 'Tidak dapat menghubungi Google Drive.',
    };
  } finally {
    clearTimeout(timer);
  }
}

function pickPublicOcmEntry(
  entries: PublicDriveEntry[],
  yyyymm: string,
  yyyymmdd: string
): PublicDriveEntry | null {
  const files = entries.filter((e) => !e.isFolder);
  const exactTxt = `regional_operation_ocm_${yyyymm}_${yyyymmdd}_41400.txt`;
  const exactZip = `regional_operation_ocm_${yyyymm}_${yyyymmdd}_41400.zip`;
  const exactBase = `regional_operation_ocm_${yyyymm}_${yyyymmdd}_41400`;

  const hitTxt = files.find((f) => f.name.toLowerCase() === exactTxt);
  if (hitTxt) return hitTxt;

  const hitZip = files.find((f) => f.name.toLowerCase() === exactZip);
  if (hitZip) return hitZip;

  const hitBase = files.find((f) => f.name.toLowerCase() === exactBase);
  if (hitBase) return hitBase;

  const token = `ocm_${yyyymm}_${yyyymmdd}_41400`;
  const hitToken = files.find((f) => f.name.toLowerCase().includes(token));
  if (hitToken) return hitToken;

  const hitDate = files.find((f) => {
    const low = f.name.toLowerCase();
    return low.includes(yyyymmdd) && low.includes('ocm');
  });
  return hitDate || null;
}

async function downloadPublicDriveFile(
  fileId: string,
  timeoutMs = 45000
): Promise<Buffer> {
  const candidates = [
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(fileId)}`,
  ];

  let lastErr: Error | null = null;

  for (const url of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });

      if (resp.url.includes('accounts.google.com')) {
        throw new Error(
          'File Google Drive memerlukan izin publik ("Siapa saja yang memiliki link").'
        );
      }
      if (!resp.ok) {
        lastErr = new Error(`HTTP ${resp.status} saat mengunduh file Google Drive.`);
        continue;
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      const buf = Buffer.from(await resp.arrayBuffer());

      // Check if Google returned an interstitial virus-scan confirmation HTML page
      const headStr = buf.subarray(0, 4096).toString('utf8');
      const looksLikeHtml =
        contentType.includes('text/html') ||
        /^\s*<!doctype html/i.test(headStr) ||
        /^\s*<html/i.test(headStr);

      if (looksLikeHtml && headStr.includes('download-form')) {
        const actionMatch = headStr.match(/id="download-form"[^>]*action="([^"]+)"/);
        const actionUrl = actionMatch
          ? decodeHtmlEntities(actionMatch[1])
          : 'https://drive.usercontent.google.com/download';

        const hiddenInputs = Array.from(
          headStr.matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)
        );
        const qs = new URLSearchParams();
        for (const m of hiddenInputs) {
          qs.set(m[1], decodeHtmlEntities(m[2]));
        }
        if (!qs.has('confirm')) qs.set('confirm', 't');

        const confirmUrl = new URL(actionUrl);
        if (
          confirmUrl.hostname === 'drive.usercontent.google.com' ||
          confirmUrl.hostname === 'drive.google.com'
        ) {
          qs.forEach((v, k) => confirmUrl.searchParams.set(k, v));
          const cookieHeader = resp.headers.get('set-cookie') || '';
          const resp2 = await fetch(confirmUrl.toString(), {
            redirect: 'follow',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            signal: controller.signal,
          });
          if (resp2.ok) {
            return Buffer.from(await resp2.arrayBuffer());
          }
        }
      }

      if (!looksLikeHtml) {
        return buf;
      }

      lastErr = new Error(
        'Google Drive mengembalikan halaman HTML bukan isi file OCM. Pastikan akses file publik aktif.'
      );
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('Gagal mengunduh file.');
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr || new Error('Gagal mengunduh file dari Google Drive.');
}

function resolveSafeBridgeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    if (u.hostname !== 'script.google.com' || !u.pathname.startsWith('/macros/s/')) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function finalizeOcmBuffer(options: {
  buffer: Buffer;
  fileName: string;
  date: OcmDateInfo;
  targetPath: string;
  checkedAt: string;
  availableFiles: string[];
  cacheKey: string;
}): OcmRealtimeResult {
  const { buffer, fileName, date, targetPath, checkedAt, availableFiles, cacheKey } = options;
  const isZip =
    fileName.toLowerCase().endsWith('.zip') ||
    (buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04);

  let rawText = '';
  let resolvedEntryName = fileName;

  if (isZip) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const txtEntries = entries.filter((e) => e.entryName.toLowerCase().endsWith('.txt'));
    const chosenEntry =
      txtEntries.find((e) => e.entryName.toUpperCase().includes('41400')) ||
      txtEntries.find((e) => e.entryName.toUpperCase().includes('OCM')) ||
      txtEntries[0];

    if (!chosenEntry) {
      return {
        success: false,
        status: 'txt_not_found',
        date,
        targetPath,
        entryName: fileName,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: null,
        availableFiles,
        errorMessage: `File teks (.txt) tidak ditemukan di dalam arsip ${fileName}.`,
        metricsByCollId: {},
      };
    }
    resolvedEntryName = `${fileName} -> ${chosenEntry.entryName}`;
    rawText = chosenEntry.getData().toString('utf8');
  } else {
    rawText = buffer.toString('utf8');
  }

  const parsed = parseOcmDollarDelimitedText(rawText);
  if (parsed.status === 'invalid_columns') {
    return {
      success: false,
      status: 'invalid_columns',
      date,
      targetPath,
      entryName: resolvedEntryName,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      availableFiles,
      errorMessage: `Kolom wajib (${parsed.missingColumns?.join(', ')}) tidak ditemukan pada file ${resolvedEntryName}.`,
      metricsByCollId: {},
    };
  }

  const collectorCount = Object.keys(parsed.metricsByCollId).length;
  setPublicDriveCache(cacheKey, {
    cachedAt: Date.now(),
    entryName: resolvedEntryName,
    rowCount: parsed.rowCount,
    collectorCount,
    fileSizeBytes: buffer.length,
    availableCycles: parsed.availableCycles,
    metricsByCollId: parsed.metricsByCollId,
    metricsByCycle: parsed.metricsByCycle,
  });

  return {
    success: true,
    status: 'ok',
    date,
    targetPath,
    entryName: resolvedEntryName,
    rowCount: parsed.rowCount,
    collectorCount,
    checkedAt,
    fileMtimeMs: null,
    fileSizeBytes: buffer.length,
    fromCache: false,
    availableFiles,
    availableCycles: parsed.availableCycles,
    metricsByCollId: parsed.metricsByCollId,
    metricsByCycle: parsed.metricsByCycle,
  };
}

async function readOcmViaAppsScriptBridge(options: {
  bridgeUrl: URL;
  folderId: string;
  date: OcmDateInfo;
  targetPath: string;
  checkedAt: string;
  forceDownload: boolean;
}): Promise<OcmRealtimeResult> {
  const { bridgeUrl, folderId, date, targetPath, checkedAt, forceDownload } = options;
  const cacheKey = `bridge|${folderId}|${date.yyyymmdd}`;
  if (!forceDownload) {
    const cached = publicDriveCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < DRIVE_CACHE_TTL_MS) {
      return {
        success: true,
        status: 'ok',
        date,
        targetPath,
        entryName: cached.entryName,
        rowCount: cached.rowCount,
        collectorCount: cached.collectorCount,
        checkedAt,
        fileMtimeMs: null,
        fileSizeBytes: cached.fileSizeBytes,
        fromCache: true,
        availableCycles: cached.availableCycles,
        metricsByCollId: cached.metricsByCollId,
        metricsByCycle: cached.metricsByCycle,
      };
    }
  }

  const reqUrl = new URL(bridgeUrl.toString());
  reqUrl.searchParams.set('folderId', folderId);
  reqUrl.searchParams.set('yyyymm', date.yyyymm);
  reqUrl.searchParams.set('yyyymmdd', date.yyyymmdd);
  reqUrl.searchParams.set('ddMinus1', date.ddMinus1);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const resp = await fetch(reqUrl.toString(), {
      redirect: 'follow',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      return {
        success: false,
        status: 'unreachable',
        date,
        targetPath,
        entryName: null,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: null,
        errorMessage: `Gagal menghubungi Google Apps Script Bridge (HTTP ${resp.status}).`,
        metricsByCollId: {},
      };
    }

    const payload = (await resp.json()) as {
      found?: boolean;
      fileName?: string;
      text?: string;
      base64?: string;
      rowCount?: number;
      fileSizeBytes?: number;
      metricsByCollId?: Record<string, Partial<OcmCollMetrics>>;
      availableFiles?: string[];
      error?: string;
    };

    const availableFiles = Array.isArray(payload.availableFiles)
      ? payload.availableFiles.slice(0, 10)
      : [];

    if (!payload.found) {
      return {
        success: false,
        status: 'zip_not_found',
        date,
        targetPath,
        entryName: null,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: null,
        availableFiles,
        errorMessage:
          payload.error ||
          `File Regional_Operation_OCM_${date.yyyymm}_${date.yyyymmdd}_41400 belum ditemukan di Google Drive.`,
        metricsByCollId: {},
      };
    }

    if (
      payload.metricsByCollId &&
      typeof payload.metricsByCollId === 'object' &&
      !Array.isArray(payload.metricsByCollId)
    ) {
      const normalized: Record<string, OcmCollMetrics> = {};
      for (const [rawId, item] of Object.entries(payload.metricsByCollId)) {
        const collId = rawId.trim().toUpperCase();
        if (!collId || !item || typeof item !== 'object') continue;
        const rolling = Number.isFinite(Number(item.rolling)) ? Number(item.rolling) : 0;
        const pkkAwTotal = Number.isFinite(Number(item.pkkAwTotal)) ? Number(item.pkkAwTotal) : 0;
        const inPercent =
          pkkAwTotal > 0
            ? Math.round(((rolling / pkkAwTotal) * 100) * 100) / 100
            : 0;
        normalized[collId] = {
          collId,
          collName: typeof item.collName === 'string' && item.collName.trim() ? item.collName.trim() : '-',
          rolling,
          pkkAwTotal,
          inPercent,
          lkpRowCount: Number.isFinite(Number(item.lkpRowCount)) ? Number(item.lkpRowCount) : 0,
          rollingRowCount: Number.isFinite(Number(item.rollingRowCount))
            ? Number(item.rollingRowCount)
            : 0,
        };
      }
      const entryName =
        payload.fileName ||
        `Regional_Operation_OCM_${date.yyyymm}_${date.yyyymmdd}_41400.txt`;
      const collectorCount = Object.keys(normalized).length;
      const rowCount = Number.isFinite(Number(payload.rowCount))
        ? Number(payload.rowCount)
        : collectorCount;
      const fileSizeBytes = Number.isFinite(Number(payload.fileSizeBytes))
        ? Number(payload.fileSizeBytes)
        : null;

      setPublicDriveCache(cacheKey, {
        cachedAt: Date.now(),
        entryName,
        rowCount,
        collectorCount,
        fileSizeBytes: fileSizeBytes ?? 0,
        availableCycles: [],
        metricsByCollId: normalized,
        metricsByCycle: {},
      });

      return {
        success: true,
        status: 'ok',
        date,
        targetPath,
        entryName,
        rowCount,
        collectorCount,
        checkedAt,
        fileMtimeMs: null,
        fileSizeBytes,
        fromCache: false,
        availableFiles,
        availableCycles: [],
        metricsByCollId: normalized,
        metricsByCycle: {},
      };
    }

    const buffer = payload.base64
      ? Buffer.from(payload.base64, 'base64')
      : Buffer.from(payload.text || '', 'utf8');

    return finalizeOcmBuffer({
      buffer,
      fileName:
        payload.fileName ||
        `Regional_Operation_OCM_${date.yyyymm}_${date.yyyymmdd}_41400.txt`,
      date,
      targetPath,
      checkedAt,
      availableFiles,
      cacheKey,
    });
  } catch (err) {
    return {
      success: false,
      status: 'error',
      date,
      targetPath,
      entryName: null,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      errorMessage:
        err instanceof Error
          ? `Gagal membaca OCM via Apps Script: ${err.message}`
          : 'Gagal membaca OCM via Apps Script.',
      metricsByCollId: {},
    };
  } finally {
    clearTimeout(timer);
  }
}

interface DriveApiFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
}

async function listDriveApiFolder(
  folderId: string,
  apiKey: string,
  timeoutMs = 12000
): Promise<{ ok: true; files: DriveApiFile[] } | { ok: false; status: number; message: string }> {
  const qs = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    key: apiKey,
  });
  const url = `https://www.googleapis.com/drive/v3/files?${qs.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      let msg = `Google Drive API HTTP ${resp.status}`;
      try {
        const errJson = (await resp.json()) as { error?: { message?: string } };
        if (errJson?.error?.message) msg = errJson.error.message;
      } catch {
        // Ignore
      }
      return { ok: false, status: resp.status, message: msg };
    }
    const json = (await resp.json()) as { files?: DriveApiFile[] };
    return { ok: true, files: Array.isArray(json.files) ? json.files : [] };
  } finally {
    clearTimeout(timer);
  }
}

async function readOcmViaDriveApiKey(options: {
  apiKey: string;
  folderId: string;
  date: OcmDateInfo;
  targetPath: string;
  checkedAt: string;
  forceDownload: boolean;
}): Promise<OcmRealtimeResult> {
  const { apiKey, folderId, date, targetPath, checkedAt, forceDownload } = options;
  const rootRes = await listDriveApiFolder(folderId, apiKey);
  if (!rootRes.ok) {
    return {
      success: false,
      status: rootRes.status === 403 || rootRes.status === 404 ? 'permission_required' : 'unreachable',
      date,
      targetPath,
      entryName: null,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      errorMessage: `Gagal membaca Google Drive (${rootRes.message}). Pastikan Google Drive API aktif pada GOOGLE_DRIVE_API_KEY dan folder dibagikan "Siapa saja yang memiliki link".`,
      metricsByCollId: {},
    };
  }

  const toEntry = (f: DriveApiFile): PublicDriveEntry => ({
    id: f.id,
    name: f.name,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    modifiedHint: `${f.modifiedTime || ''}|${f.size || ''}`,
  });

  const rootEntries = rootRes.files.map(toEntry);
  const availableFiles = rootEntries
    .filter((e) => !e.isFolder)
    .map((e) => e.name)
    .slice(0, 10);

  let matched = pickPublicOcmEntry(rootEntries, date.yyyymm, date.yyyymmdd);
  if (!matched) {
    const monthFolder = rootEntries.find((e) => e.isFolder && e.name === date.yyyymm);
    if (monthFolder) {
      const mRes = await listDriveApiFolder(monthFolder.id, apiKey);
      if (mRes.ok) {
        const mEntries = mRes.files.map(toEntry);
        matched = pickPublicOcmEntry(mEntries, date.yyyymm, date.yyyymmdd);
        if (!matched) {
          const dayFolder = mEntries.find((e) => e.isFolder && e.name === date.ddMinus1);
          if (dayFolder) {
            const dRes = await listDriveApiFolder(dayFolder.id, apiKey);
            if (dRes.ok) {
              const dEntries = dRes.files.map(toEntry);
              matched = pickPublicOcmEntry(dEntries, date.yyyymm, date.yyyymmdd);
              if (!matched) {
                const regFolder = dEntries.find(
                  (e) => e.isFolder && e.name.toUpperCase() === 'REGION_3'
                );
                if (regFolder) {
                  const rRes = await listDriveApiFolder(regFolder.id, apiKey);
                  if (rRes.ok) {
                    matched = pickPublicOcmEntry(rRes.files.map(toEntry), date.yyyymm, date.yyyymmdd);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (!matched) {
    return {
      success: false,
      status: 'zip_not_found',
      date,
      targetPath,
      entryName: null,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      availableFiles,
      errorMessage: `File Regional_Operation_OCM_${date.yyyymm}_${date.yyyymmdd}_41400 (.txt / .zip) belum ditemukan di Google Drive.`,
      metricsByCollId: {},
    };
  }

  const cacheKey = `apikey|${matched.id}|${matched.modifiedHint}`;
  if (!forceDownload) {
    const cached = publicDriveCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < DRIVE_CACHE_TTL_MS) {
      return {
        success: true,
        status: 'ok',
        date,
        targetPath,
        entryName: cached.entryName,
        rowCount: cached.rowCount,
        collectorCount: cached.collectorCount,
        checkedAt,
        fileMtimeMs: null,
        fileSizeBytes: cached.fileSizeBytes,
        fromCache: true,
        availableFiles,
        availableCycles: cached.availableCycles,
        metricsByCollId: cached.metricsByCollId,
        metricsByCycle: cached.metricsByCycle,
      };
    }
  }

  const dlUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    matched.id
  )}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const dlResp = await fetch(dlUrl, { signal: controller.signal });
    if (!dlResp.ok) {
      return {
        success: false,
        status: 'error',
        date,
        targetPath,
        entryName: matched.name,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: null,
        availableFiles,
        errorMessage: `Gagal mengunduh ${matched.name} dari Google Drive (HTTP ${dlResp.status}).`,
        metricsByCollId: {},
      };
    }
    const buffer = Buffer.from(await dlResp.arrayBuffer());
    return finalizeOcmBuffer({
      buffer,
      fileName: matched.name,
      date,
      targetPath,
      checkedAt,
      availableFiles,
      cacheKey,
    });
  } catch (err) {
    return {
      success: false,
      status: 'error',
      date,
      targetPath,
      entryName: matched.name,
      rowCount: 0,
      collectorCount: 0,
      checkedAt,
      fileMtimeMs: null,
      availableFiles,
      errorMessage:
        err instanceof Error
          ? `Gagal mengunduh file dari Google Drive: ${err.message}`
          : 'Gagal mengunduh file dari Google Drive.',
      metricsByCollId: {},
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function readOcmRealtime(
  year: number,
  month: number,
  day: number,
  periodPrefix = 'CL',
  forceDownload = false
): Promise<OcmRealtimeResult> {
  if ((process.env.RPT_NETWORK_ROOT || '').trim()) {
    return readOcmRealtimeZip(year, month, day, periodPrefix);
  }

  const checkedAt = new Date().toISOString();
  const folderId = DEFAULT_OCM_DRIVE_FOLDER_ID;
  const { date } = buildOcmDateAndPath(year, month, day, periodPrefix);
  const expectedBase = `Regional_Operation_OCM_${date.yyyymm}_${date.yyyymmdd}_41400`;
  const targetPath = `https://drive.google.com/drive/folders/${folderId}`;

  const bridgeRaw = (process.env.OCM_DRIVE_BRIDGE_URL || '').trim();
  if (bridgeRaw) {
    const safeBridge = resolveSafeBridgeUrl(bridgeRaw);
    if (safeBridge) {
      return readOcmViaAppsScriptBridge({
        bridgeUrl: safeBridge,
        folderId,
        date,
        targetPath,
        checkedAt,
        forceDownload,
      });
    }
  }

  const driveApiKey = (process.env.GOOGLE_DRIVE_API_KEY || '').trim();
  if (driveApiKey) {
    return readOcmViaDriveApiKey({
      apiKey: driveApiKey,
      folderId,
      date,
      targetPath,
      checkedAt,
      forceDownload,
    });
  }

  const flightKey = `${folderId}|${date.yyyymmdd}|${date.periodLabel}`;
  const existingFlight = inFlightPublicOcm.get(flightKey);
  if (existingFlight) {
    return existingFlight;
  }

  const runPublicDrive = async (): Promise<OcmRealtimeResult> => {
    const rootList = await listPublicDriveFolder(folderId, 12000, forceDownload);
    if (!rootList.ok) {
      return {
        success: false,
        status: rootList.permissionRequired ? 'permission_required' : 'unreachable',
        date,
        targetPath,
        entryName: null,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: null,
        errorMessage: rootList.message,
        metricsByCollId: {},
      };
    }

    let matched = pickPublicOcmEntry(rootList.entries, date.yyyymm, date.yyyymmdd);
    const availableFiles = rootList.entries
      .filter((e) => !e.isFolder)
      .map((e) => e.name)
      .slice(0, 10);

    if (!matched) {
      const monthFolder = rootList.entries.find(
        (e) => e.isFolder && e.name === date.yyyymm
      );
      if (monthFolder) {
        const monthList = await listPublicDriveFolder(monthFolder.id, 12000, forceDownload);
        if (monthList.ok) {
          matched = pickPublicOcmEntry(monthList.entries, date.yyyymm, date.yyyymmdd);
          if (!matched) {
            const dayFolder = monthList.entries.find(
              (e) => e.isFolder && e.name === date.ddMinus1
            );
            if (dayFolder) {
              const dayList = await listPublicDriveFolder(dayFolder.id, 12000, forceDownload);
              if (dayList.ok) {
                matched = pickPublicOcmEntry(dayList.entries, date.yyyymm, date.yyyymmdd);
                if (!matched) {
                  const regFolder = dayList.entries.find(
                    (e) => e.isFolder && e.name.toUpperCase() === 'REGION_3'
                  );
                  if (regFolder) {
                    const regList = await listPublicDriveFolder(regFolder.id, 12000, forceDownload);
                    if (regList.ok) {
                      matched = pickPublicOcmEntry(regList.entries, date.yyyymm, date.yyyymmdd);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!matched) {
      return {
        success: false,
        status: 'zip_not_found',
        date,
        targetPath,
        entryName: null,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: null,
        availableFiles,
        errorMessage: `File ${expectedBase} (.txt / .zip) untuk tanggal ${pad2(day)}/${pad2(month)}/${year} belum ditemukan.`,
        metricsByCollId: {},
      };
    }

    const cacheKey = `${matched.id}|${matched.modifiedHint}`;
    const nowMs = Date.now();
    if (!forceDownload) {
      const cached = publicDriveCache.get(cacheKey);
      if (cached && nowMs - cached.cachedAt < DRIVE_CACHE_TTL_MS) {
        return {
          success: true,
          status: 'ok',
          date,
          targetPath,
          entryName: cached.entryName,
          rowCount: cached.rowCount,
          collectorCount: cached.collectorCount,
          checkedAt,
          fileMtimeMs: null,
          fileSizeBytes: cached.fileSizeBytes,
          fromCache: true,
          availableFiles,
          availableCycles: cached.availableCycles,
          metricsByCollId: cached.metricsByCollId,
          metricsByCycle: cached.metricsByCycle,
        };
      }
    }

    try {
      const buffer = await downloadPublicDriveFile(matched.id);
      return finalizeOcmBuffer({
        buffer,
        fileName: matched.name,
        date,
        targetPath,
        checkedAt,
        availableFiles,
        cacheKey,
      });
    } catch (err) {
      return {
        success: false,
        status: 'error',
        date,
        targetPath,
        entryName: matched.name,
        rowCount: 0,
        collectorCount: 0,
        checkedAt,
        fileMtimeMs: null,
        availableFiles,
        errorMessage:
          err instanceof Error
            ? err.message
            : `Gagal membaca file ${matched.name}.`,
        metricsByCollId: {},
      };
    }
  };

  const promise = runPublicDrive().finally(() => {
    inFlightPublicOcm.delete(flightKey);
  });
  inFlightPublicOcm.set(flightKey, promise);
  return promise;
}



