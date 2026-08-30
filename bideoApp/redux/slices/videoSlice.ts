import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface VideoState {
  videos: any[];
  currentVideo: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: VideoState = {
  videos: [],
  currentVideo: null,
  loading: false,
  error: null,
};

const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    fetchVideosStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchVideosSuccess: (state, action: PayloadAction<any[]>) => {
      state.loading = false;
      state.videos = action.payload;
    },
    appendVideos: (state, action: PayloadAction<any[]>) => {
      state.loading = false;
      // Filter out any duplicates by _id
      const existingIds = new Set(state.videos.map(v => v._id));
      const newUnique = action.payload.filter(v => !existingIds.has(v._id));
      state.videos = [...state.videos, ...newUnique];
    },
    fetchVideosFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setCurrentVideo: (state, action: PayloadAction<any>) => {
      state.currentVideo = action.payload;
    },
  },
});

export const { fetchVideosStart, fetchVideosSuccess, appendVideos, fetchVideosFailure, setCurrentVideo } = videoSlice.actions;
export default videoSlice.reducer;
