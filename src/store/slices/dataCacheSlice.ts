import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "@/plugin/axios";
import type { RootState } from "@/store/store";

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
  facultiesStatus: "idle",
  subjectsStatus: "idle",
  roomsStatus: "idle",
  facultyLoadingStatus: "idle",
  error: null,
};

const authHeader = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchFaculties = createAsyncThunk("dataCache/fetchFaculties", async (_force: boolean = false) => {
  const response = await axios.get("/faculties", { headers: authHeader() });
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
  const response = await axios.get("/get-subjects", { headers: authHeader() });
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
  const response = await axios.get("/rooms", { headers: authHeader() });
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
  const response = await axios.get("/get-faculty-loading", { headers: authHeader() });
  return response.data.success ? response.data.data || [] : [];
}, {
  condition: (force, { getState }) => {
    if (force) return true;
    const state = getState() as RootState;
    const { facultyLoadingStatus } = state.dataCache;
    return !(facultyLoadingStatus === "loading" || facultyLoadingStatus === "succeeded");
  },
});

const dataCacheSlice = createSlice({
  name: "dataCache",
  initialState,
  reducers: {},
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
      });
  },
});

export default dataCacheSlice.reducer;
