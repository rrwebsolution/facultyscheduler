import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "@/plugin/axios";
import type { RootState } from "@/store/store";
import type { ScheduleEntry } from "@/views/admin/room/classroom";

type FetchStatus = "idle" | "loading" | "succeeded" | "failed";

export interface CachedFaculty {
  id: number;
  name: string;
  department: string;
  expertise: string[];
  profile_picture: string | null;
  t_load_units: number;
  deload_units: number;
  overload_units: number;
  availability: Record<string, unknown>;
  assignedSubjects: unknown[];
}

interface DataCacheState {
  faculties: CachedFaculty[];
  subjects: any[];
  rooms: any[];
  facultyLoading: any[];
  filteredSchedules: ScheduleEntry[];
  scheduleCacheByKey: Record<string, ScheduleEntry[]>;
  scheduleStatusByKey: Record<string, FetchStatus>;
  selectedScheduleFilter: { year: number | null; section: string | null; programId: number | null };
  selectedScheduleKey: string | null;
  facultiesStatus: FetchStatus;
  subjectsStatus: FetchStatus;
  roomsStatus: FetchStatus;
  facultyLoadingStatus: FetchStatus;
  error: string | null;
}

const initialState: DataCacheState = {
  faculties: [],
  subjects: [],
  rooms: [],
  facultyLoading: [],
  filteredSchedules: [],
  scheduleCacheByKey: {},
  scheduleStatusByKey: {},
  selectedScheduleFilter: { year: null, section: null, programId: null },
  selectedScheduleKey: null,
  facultiesStatus: "idle",
  subjectsStatus: "idle",
  roomsStatus: "idle",
  facultyLoadingStatus: "idle",
  error: null,
};

const makeScheduleKey = (year: number | null, section: string | null, programId: number | null) =>
  `${programId ?? "none"}|${year ?? "none"}|${(section || "").trim() || "all"}`;

const authHeader = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchFaculties = createAsyncThunk("dataCache/fetchFaculties", async (_force: boolean = false) => {
  const response = await axios.get("/faculties", {
    headers: authHeader(),
    params: _force ? { _ts: Date.now() } : undefined,
  });
  const mapped = (response.data.faculties || []).map((f: any) => ({
    id: f.id,
    name: f.user?.name || "",
    department: f.department || "No Department",
    expertise: f.expertises ? f.expertises.map((e: any) => e.list_of_expertise) : [],
    profile_picture: f.profile_picture || null,
    t_load_units: f.t_load_units ?? 0,
    deload_units: f.deload_units ?? 0,
    overload_units: f.overload_units ?? 0,
    availability: {},
    assignedSubjects: [],
  }));
  return mapped as CachedFaculty[];
}, {
  condition: (force, { getState }) => {
    if (force) return true;
    const state = getState() as RootState;
    const { facultiesStatus } = state.dataCache;
    return !(facultiesStatus === "loading" || facultiesStatus === "succeeded");
  },
});

export const fetchSubjects = createAsyncThunk("dataCache/fetchSubjects", async (_force: boolean = false) => {
  const response = await axios.get("/get-subjects", {
    headers: authHeader(),
    params: _force ? { _ts: Date.now() } : undefined,
  });
  return response.data.subject || [];
}, {
  condition: (force, { getState }) => {
    if (force) return true;
    const state = getState() as RootState;
    const { subjectsStatus } = state.dataCache;
    return !(subjectsStatus === "loading" || subjectsStatus === "succeeded");
  },
});

export const fetchRooms = createAsyncThunk("dataCache/fetchRooms", async (_force: boolean = false) => {
  const response = await axios.get("/rooms", {
    headers: authHeader(),
    params: _force ? { _ts: Date.now() } : undefined,
  });
  return response.data.rooms || [];
}, {
  condition: (force, { getState }) => {
    if (force) return true;
    const state = getState() as RootState;
    const { roomsStatus } = state.dataCache;
    return !(roomsStatus === "loading" || roomsStatus === "succeeded");
  },
});

export const fetchFacultyLoading = createAsyncThunk("dataCache/fetchFacultyLoading", async (_force: boolean = false) => {
  const response = await axios.get("/get-faculty-loading", {
    headers: authHeader(),
    params: _force ? { _ts: Date.now() } : undefined,
  });
  return response.data.success ? response.data.data || [] : [];
}, {
  condition: (force, { getState }) => {
    if (force) return true;
    const state = getState() as RootState;
    const { facultyLoadingStatus } = state.dataCache;
    return !(facultyLoadingStatus === "loading" || facultyLoadingStatus === "succeeded");
  },
});

export const fetchFilteredSchedules = createAsyncThunk(
  "dataCache/fetchFilteredSchedules",
  async (
    args: { year: number | null; section: string | null; programId: number | null; forceRefresh?: boolean },
    _thunkApi
  ) => {
    const { year, section, programId, forceRefresh = false } = args;
    const key = makeScheduleKey(year, section, programId);

    if (!programId) {
      return {
        key,
        data: [] as ScheduleEntry[],
        message: year || section ? "Program id is required for filtering schedules." : "No program selected; schedule list is empty.",
        filter: { year, section, programId },
      };
    }

    const payload: Record<string, any> = { program_id: programId };
    if (year) payload.year_level = year;
    if (section && section.trim()) payload.section = section.trim();
    if (forceRefresh) payload._ts = Date.now();

    const response = await axios.post("/filter-schedule", payload, {
      headers: {
        ...authHeader(),
        "Content-Type": "application/json",
      },
    });

    if (response.data?.success) {
      return {
        key,
        data: (response.data.data || []) as ScheduleEntry[],
        message: response.data.message as string | undefined,
        filter: { year, section, programId },
      };
    }

    throw new Error(response.data?.message || "Failed to fetch schedules.");
  },
  {
    condition: (args, { getState }) => {
      const { year, section, programId, forceRefresh = false } = args;
      if (forceRefresh) return true;
      const state = getState() as RootState;
      const key = makeScheduleKey(year, section, programId);
      const status = state.dataCache.scheduleStatusByKey[key];
      return status !== "loading" && status !== "succeeded";
    },
  }
);

const dataCacheSlice = createSlice({
  name: "dataCache",
  initialState,
  reducers: {
    setSelectedScheduleFilter: (
      state,
      action: {
        payload: { year: number | null; section: string | null; programId: number | null };
      }
    ) => {
      const { year, section, programId } = action.payload;
      const key = makeScheduleKey(year, section, programId);
      if (state.selectedScheduleKey === key) {
        return;
      }
      state.selectedScheduleFilter = { year, section, programId };
      state.selectedScheduleKey = key;
      state.filteredSchedules = state.scheduleCacheByKey[key] || [];
    },
    clearSelectedScheduleFilter: (state) => {
      state.selectedScheduleFilter = { year: null, section: null, programId: null };
      state.selectedScheduleKey = null;
      state.filteredSchedules = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFaculties.pending, (state) => {
        state.facultiesStatus = "loading";
      })
      .addCase(fetchFaculties.fulfilled, (state, action) => {
        state.faculties = action.payload;
        state.facultiesStatus = "succeeded";
      })
      .addCase(fetchFaculties.rejected, (state, action) => {
        state.facultiesStatus = "failed";
        state.error = action.error.message || "Failed to fetch faculties";
      })
      .addCase(fetchSubjects.pending, (state) => {
        state.subjectsStatus = "loading";
      })
      .addCase(fetchSubjects.fulfilled, (state, action) => {
        state.subjects = action.payload;
        state.subjectsStatus = "succeeded";
      })
      .addCase(fetchSubjects.rejected, (state, action) => {
        state.subjectsStatus = "failed";
        state.error = action.error.message || "Failed to fetch subjects";
      })
      .addCase(fetchRooms.pending, (state) => {
        state.roomsStatus = "loading";
      })
      .addCase(fetchRooms.fulfilled, (state, action) => {
        state.rooms = action.payload;
        state.roomsStatus = "succeeded";
      })
      .addCase(fetchRooms.rejected, (state, action) => {
        state.roomsStatus = "failed";
        state.error = action.error.message || "Failed to fetch rooms";
      })
      .addCase(fetchFacultyLoading.pending, (state) => {
        state.facultyLoadingStatus = "loading";
      })
      .addCase(fetchFacultyLoading.fulfilled, (state, action) => {
        state.facultyLoading = action.payload;
        state.facultyLoadingStatus = "succeeded";
      })
      .addCase(fetchFacultyLoading.rejected, (state, action) => {
        state.facultyLoadingStatus = "failed";
        state.error = action.error.message || "Failed to fetch faculty loading";
      })
      .addCase(fetchFilteredSchedules.pending, (state, action) => {
        const { year, section, programId } = action.meta.arg;
        const key = makeScheduleKey(year, section, programId);
        state.scheduleStatusByKey[key] = "loading";
      })
      .addCase(fetchFilteredSchedules.fulfilled, (state, action) => {
        const { key, data, filter } = action.payload;
        state.scheduleStatusByKey[key] = "succeeded";
        state.scheduleCacheByKey[key] = data;
        state.selectedScheduleFilter = filter;
        state.selectedScheduleKey = key;
        state.filteredSchedules = data;
      })
      .addCase(fetchFilteredSchedules.rejected, (state, action) => {
        const { year, section, programId } = action.meta.arg;
        const key = makeScheduleKey(year, section, programId);
        state.scheduleStatusByKey[key] = "failed";
        state.error = action.error.message || "Failed to fetch schedules";
      });
  },
});

export const { setSelectedScheduleFilter, clearSelectedScheduleFilter } = dataCacheSlice.actions;
export default dataCacheSlice.reducer;
