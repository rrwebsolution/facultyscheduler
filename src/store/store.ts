import { configureStore } from "@reduxjs/toolkit";
import dataCacheReducer from "./slices/dataCacheSlice";

const CACHE_STORAGE_KEY = "fs_data_cache_v1";

const loadPreloadedState = () => {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      faculties?: unknown[];
      subjects?: unknown[];
      rooms?: unknown[];
      facultyLoading?: unknown[];
      facultiesStatus?: "idle" | "loading" | "succeeded" | "failed";
      subjectsStatus?: "idle" | "loading" | "succeeded" | "failed";
      roomsStatus?: "idle" | "loading" | "succeeded" | "failed";
      facultyLoadingStatus?: "idle" | "loading" | "succeeded" | "failed";
    };

    const faculties = Array.isArray(parsed.faculties) ? parsed.faculties : [];
    const subjects = Array.isArray(parsed.subjects) ? parsed.subjects : [];
    const rooms = Array.isArray(parsed.rooms) ? parsed.rooms : [];
    const facultyLoading = Array.isArray(parsed.facultyLoading) ? parsed.facultyLoading : [];

    const facultiesStatus = parsed.facultiesStatus || "idle";
    const subjectsStatus = parsed.subjectsStatus || "idle";
    const roomsStatus = parsed.roomsStatus || "idle";
    const facultyLoadingStatus = parsed.facultyLoadingStatus || "idle";

    return {
      dataCache: {
        faculties,
        subjects,
        rooms,
        facultyLoading,
        facultiesStatus,
        subjectsStatus,
        roomsStatus,
        facultyLoadingStatus,
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
    const cacheOnly = {
      faculties: state.dataCache.faculties,
      subjects: state.dataCache.subjects,
      rooms: state.dataCache.rooms,
      facultyLoading: state.dataCache.facultyLoading,
      facultiesStatus: state.dataCache.facultiesStatus,
      subjectsStatus: state.dataCache.subjectsStatus,
      roomsStatus: state.dataCache.roomsStatus,
      facultyLoadingStatus: state.dataCache.facultyLoadingStatus,
    };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheOnly));
  } catch {
    // Ignore storage write errors silently.
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
