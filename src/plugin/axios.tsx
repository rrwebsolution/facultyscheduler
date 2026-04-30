import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_URL}/api/`,
});

api.defaults.headers.post['Content-Type'] = 'application/json';
api.defaults.headers.get.Accept = 'application/json';

const CACHE_PREFIX = 'fs_http_cache_v2:';
const inFlightGetRequests = new Map<string, Promise<AxiosResponse>>();
const scheduleRequestCounters = new Map<string, number>();

const normalizeUrl = (url?: string) => {
  if (!url) return '';
  return url.startsWith('/') ? url : `/${url}`;
};

const createRequestKey = (url: string, config?: AxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken') || 'guest';
  const params = config?.params ? JSON.stringify(config.params) : '';
  return `${CACHE_PREFIX}${token}:${normalizeUrl(url)}:${params}`;
};

const clearApiCache = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
};

const isDev = import.meta.env.DEV;

const getScheduleFilterKeyFromData = (data: unknown) => {
  if (!data) return null;
  let payload: any = data;
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data);
    } catch {
      return null;
    }
  }
  const programId = payload?.program_id ?? 'none';
  const year = payload?.year_level ?? 'none';
  const section = payload?.section ?? 'all';
  return `${programId}|${year}|${section}`;
};

const baseGet = api.get.bind(api);
api.get = ((url: string, config?: AxiosRequestConfig) => {
  const method = (config?.method || 'get').toLowerCase();
  const skipCacheHeader = Boolean((config?.headers as Record<string, unknown> | undefined)?.['x-skip-cache']);
  const isCacheable = method === 'get' && !skipCacheHeader;

  if (!isCacheable) {
    return baseGet(url, config);
  }

  const requestKey = createRequestKey(url, config);

  const cachedRaw = localStorage.getItem(requestKey);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as { data: unknown; headers?: Record<string, string> };
      return Promise.resolve({
        data: cached.data,
        status: 200,
        statusText: 'OK',
        headers: cached.headers || {},
        config: { ...(config || {}), url },
        request: {},
      } as AxiosResponse);
    } catch {
      localStorage.removeItem(requestKey);
    }
  }

  const existingPromise = inFlightGetRequests.get(requestKey);
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = baseGet(url, config)
    .then((response) => {
      try {
        localStorage.setItem(
          requestKey,
          JSON.stringify({
            data: response.data,
            headers: response.headers,
          })
        );
      } catch {
        // Ignore storage write errors.
      }
      return response;
    })
    .finally(() => {
      inFlightGetRequests.delete(requestKey);
    });

  inFlightGetRequests.set(requestKey, requestPromise);
  return requestPromise;
}) as typeof api.get;

api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || '').toLowerCase();
    if (method === 'post' || method === 'put' || method === 'patch' || method === 'delete') {
      clearApiCache();
    }
    return response;
  },
  (error) => Promise.reject(error)
);

api.interceptors.request.use((config) => {
  if (!isDev) return config;

  const method = (config.method || '').toLowerCase();
  const url = normalizeUrl(config.url);
  if (method === 'post' && url.includes('/filter-schedule')) {
    const filterKey = getScheduleFilterKeyFromData(config.data) || 'unknown';
    const nextCount = (scheduleRequestCounters.get(filterKey) || 0) + 1;
    scheduleRequestCounters.set(filterKey, nextCount);
    console.info(`[SCHEDULE-REQ] hit #${nextCount} key=${filterKey}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (!isDev) return response;
    const method = (response.config.method || '').toLowerCase();
    const url = normalizeUrl(response.config.url);
    if (method === 'post' && url.includes('/filter-schedule')) {
      const filterKey = getScheduleFilterKeyFromData(response.config.data) || 'unknown';
      const totalHits = scheduleRequestCounters.get(filterKey) || 0;
      console.info(`[SCHEDULE-REQ] success key=${filterKey} totalHits=${totalHits}`);
      (globalThis as any).__fsScheduleRequestCounters = Object.fromEntries(scheduleRequestCounters.entries());
    }
    return response;
  },
  (error) => {
    if (isDev) {
      const method = (error?.config?.method || '').toLowerCase();
      const url = normalizeUrl(error?.config?.url);
      if (method === 'post' && url.includes('/filter-schedule')) {
        const filterKey = getScheduleFilterKeyFromData(error?.config?.data) || 'unknown';
        const totalHits = scheduleRequestCounters.get(filterKey) || 0;
        console.warn(`[SCHEDULE-REQ] failed key=${filterKey} totalHits=${totalHits}`);
        (globalThis as any).__fsScheduleRequestCounters = Object.fromEntries(scheduleRequestCounters.entries());
      }
    }
    return Promise.reject(error);
  }
);

export default api;
