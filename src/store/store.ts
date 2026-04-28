import { configureStore } from "@reduxjs/toolkit";
import dataCacheReducer, { type CachedFaculty } from "./slices/dataCacheSlice";

const CACHE_STORAGE_KEY = "fs_data_cache_v1";
const statusFromCache = (value: unknown[] | undefined) =>
  Array.isArray(value) && value.length > 0 ? ("succeeded" as const) : ("idle" as const);

const loadPreloadedState = () => {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      faculties?: unknown[];
      subjects?: unknown[];
      rooms?: unknown[];
      facultyLoading?: unknown[];
    };

    return {
      dataCache: {
        faculties: (Array.isArray(parsed.faculties) ? parsed.faculties : []) as CachedFaculty[],
        subjects: (Array.isArray(parsed.subjects) ? parsed.subjects : []) as any[],
        rooms: (Array.isArray(parsed.rooms) ? parsed.rooms : []) as any[],
        facultyLoading: (Array.isArray(parsed.facultyLoading) ? parsed.facultyLoading : []) as any[],
        // Use cached data without auto-refetch on page reload.
        // Force refresh should be done via explicit Refresh buttons (force=true).
        facultiesStatus: statusFromCache(parsed.faculties),
        subjectsStatus: statusFromCache(parsed.subjects),
        roomsStatus: statusFromCache(parsed.rooms),
        facultyLoadingStatus: statusFromCache(parsed.facultyLoading),
        error: null,
      },
    };
  } catch {
    return undefined;
  }
};

export const store = configureStore({
  reducer: {
    dataCache: dataCacheReducer,
  },
  preloadedState: loadPreloadedState(),
});

store.subscribe(() => {
  try {
    const state = store.getState();
    // Only persist the data arrays, not statuses.
    const cacheOnly = {
      faculties: state.dataCache.faculties,
      subjects: state.dataCache.subjects,
      rooms: state.dataCache.rooms,
      facultyLoading: state.dataCache.facultyLoading,
    };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheOnly));
  } catch {
    // Ignore storage write errors silently.
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
