export type Tokens = { accessToken: string; refreshToken: string };
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

export function createClient(base: string, onExpired: () => void = () => {}) {
  let tokens: Tokens | null = null;
  let refresh: Promise<boolean> | null = null;
  let revision = 0;
  const root = base.replace(/\/$/, '');
  const save = (value: Tokens | null) => { revision++; tokens = value; };
  async function renew() {
    if (!tokens) return false;
    if (!refresh) {
      const started = revision, token = tokens.refreshToken;
      refresh = (async () => {
        try {
          const response = await fetch(`${root}/auth/refresh`, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token }),
            signal: AbortSignal.timeout(20000) });
          if (!response.ok) return false;
          const next = await response.json();
          if (revision !== started) return false;
          save(next); return true;
        } catch { return false; }
        finally { refresh = null; }
      })();
    }
    return refresh;
  }
  async function raw(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
    if (!root) throw new ApiError('This public showcase does not connect to a backend. Try the sample workspace instead.');
    const headers = new Headers(options.headers);
    if (tokens) headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await fetch(root + path, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(120000) });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError('Cannot reach GaitSense. Check that the API is running and your connection is available.');
    }
    if (response.status === 401 && !['/auth/login', '/auth/register', '/auth/refresh'].includes(path)) {
      if (tokens && retry && await renew()) return raw(path, options, false);
      save(null); onExpired();
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.detail?.code === 'CONSENT_REQUIRED' ? 'Processing consent is required. Review the current notices on New recording before continuing.' : typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail)
        ? body.detail.map((item: { msg: string }) => item.msg).join('. ') : `Request failed (${response.status}). Please try again.`;
      throw new ApiError(message, response.status);
    }
    return response;
  }
  return { save, clear: () => save(null), raw,
    async get<T>(path: string, options: RequestInit = {}): Promise<T> {
      const response = await raw(path, options);
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
    async send<T>(path: string, body?: unknown, method = 'POST', headers?: HeadersInit): Promise<T> {
      const response = await raw(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
  };
}

export type Profile = { displayName: string; yearOfBirth?: number; heightCm?: number; weightKg?: number };
export type Session = { id: string; createdAt: string; status: string; assessmentId?: string;
  capture: { angle: string; durationSeconds?: number; resolution?: { width: number; height: number } };
  processingError?: { message: string; code: string }; quality?: { messages?: string[] } };
export type PoseFrame = { timestampMs: number; landmarks: { index: number; x: number; y: number; z: number; visibility: number }[] };
export type Report = { id: string; sessionId: string; createdAt: string; angle: string; pipelineVersion: string;
  kind: string; limitations: string[]; features: { metrics: Record<string, number>;
    definitions: Record<string, { unit: string; method: string }>; unavailable: Record<string, string>;
    quality: { usableFrameRatio: number; meanLandmarkVisibility: number; warnings: string[] } } };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type ConsentDoc = { type: string; version: string; title?: string; text?: string; body?: string; content?: string };
export type Consent = { type: string; documentVersion: string; status: string };
export type Progress = { status: string; changes: Record<string, { current: number; baseline: number; delta: number }>; warning?: string };
