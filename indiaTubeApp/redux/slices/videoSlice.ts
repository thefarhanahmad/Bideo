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
    fetchVideosFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setCurrentVideo: (state, action: PayloadAction<any>) => {
      state.currentVideo = action.payload;
    },
  },
});

export const { fetchVideosStart, fetchVideosSuccess, fetchVideosFailure, setCurrentVideo } = videoSlice.actions;
export default videoSlice.reducer;
