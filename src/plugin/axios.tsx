import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_URL}/api/`,
});

api.defaults.headers.post['Content-Type'] = 'application/json';
api.defaults.headers.get.Accept = 'application/json';

const CACHE_PREFIX = 'fs_http_cache_v2:';
const inFlightGetRequests = new Map<string, Promise<AxiosResponse>>();

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

const baseGet = api.get.bind(api);
api.get = ((url: string, config?: AxiosRequestConfig) => {
  const normalizedUrl = normalizeUrl(url);
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

export default api;
