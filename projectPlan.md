# 🚀 Bideo — Full Master Plan

## Production-Grade YouTube Clone using Expo React Native + Node.js + MongoDB

---

# 📌 PROJECT OVERVIEW

Build a scalable production-grade YouTube-like mobile application named **Bideo**.

The platform should support:

- Video watching
- Shorts/Reels
- Like/Comment
- Subscribe
- Share
- Upload videos
- Public/Private videos
- Playlist system
- Watch history
- Google Login
- Channel system
- Recommendations
- Search
- Notifications

The application architecture must be fully scalable and future-ready.

---

# ⚠️ IMPORTANT DEVELOPMENT RULE

## ONLY BUILD CURRENT FEATURES

Future features should NOT be implemented now.

The should ONLY prepare scalable architecture for future expansion.

### Example:

```txt
✅ Create scalable structure for Live Streaming
❌ Do NOT implement Live Streaming now

✅ Create scalable structure for Monetization
❌ Do NOT implement Monetization now

✅ Create scalable structure for Notifications
❌ Do NOT implement advanced notification system now
```

The current goal is:

```txt
Build a stable, clean, scalable MVP first.
```

---

# 🎨 APP THEME & DESIGN SYSTEM

## IMPORTANT UI THEME

The entire app must use:

# 🤍 White + 🟧 Orange Theme

Like YouTube uses:

```txt
Red + White
```

Bideo should use:

```txt
Orange + White
```

---

# 🎨 PRIMARY COLORS

```txt
Primary Orange: #FF7A00
Secondary Orange: #FFA447
White: #FFFFFF
Light Background: #F8F8F8
Dark Text: #121212
Gray Text: #6B7280
Border Color: #E5E7EB
```

---

# 🎯 DESIGN STYLE

The UI should feel:

```txt
- Clean
- Premium
- Minimal
- Smooth
- Modern
- Mobile-first
- Fast
```

---

# 📱 UI RULES

Use Orange & White consistently across:

```txt
- Splash Screen
- Header
- Buttons
- Active Tabs
- Like Buttons
- Subscribe Button
- Progress Bars
- Loader
- Upload UI
- Bottom Tabs
- Icons
```

---

# ✨ UI EXPERIENCE

```txt
- Rounded cards
- Smooth animations
- Soft shadows
- Clean spacing
- Modern typography
- Responsive layout
- Optimized FlatLists
```

---

# 🔤 FONTS

Use:

```txt
Inter
Poppins
```

---

# 📌 PROJECT STRUCTURE

```txt
Bideo/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   ├── uploads/
│   ├── app.js
│   ├── server.js
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── bideoApp/
│   ├── app/
│   ├── assets/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── navigation/
│   ├── redux/
│   ├── screens/
│   ├── services/
│   ├── utils/
│   ├── context/
│   ├── theme/
│   ├── types/
│   ├── .env
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

# 🔐 ENVIRONMENT VARIABLE RULES

## VERY IMPORTANT

All credentials and sensitive data MUST be stored inside `.env` files.

Never hardcode credentials anywhere.

---

# 📦 BACKEND ENV VARIABLES

```env
PORT=
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRE=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

# 📱 FRONTEND ENV VARIABLES

```env
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_GOOGLE_CLIENT_ID=
```

---

# ⚠️ ENV RULES

must:

```txt
1. Use .env everywhere
2. Never hardcode secrets
3. Create .env.example files
4. Separate development & production configs
5. Use secure config handling
```

---

# 🧱 CLEAN ARCHITECTURE RULES

must follow:

```txt
1. Never write everything in one file
2. Use reusable components
3. Use modular APIs
4. Use clean architecture
5. Use scalable folder structure
6. Separate business logic
7. Use TypeScript where possible
8. Add loading/error states everywhere
9. Use proper naming conventions
10. Write production-ready code
11. Keep components reusable
12. Follow scalable architecture
13. Avoid duplicate code
14. Maintain clean imports
15. Use proper error handling
```

---

# ⚡ PERFORMANCE RULES

VERY IMPORTANT
must optimize:

```txt
- FlatList performance
- Lazy loading
- Pagination
- Memoization
- Video caching
- Image optimization
- API optimization
- Avoid unnecessary re-renders
```

---

# 📱 FRONTEND TECH STACK

Use:

- Expo React Native
- Expo Router
- TypeScript
- Redux Toolkit
- RTK Query / Axios
- React Navigation
- React Native Reanimated
- Expo AV
- Expo Image Picker
- Expo Secure Store
- React Native Gesture Handler
- React Native Bottom Sheet
- React Native Vector Icons

---

# ⚙️ BACKEND TECH STACK

Use:

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Google OAuth
- Cloudinary
- Multer
- bcryptjs

---

# 🔥 IMPORTANT UX RULES

## APP SHOULD NOT OPEN WITH LOGIN SCREEN

Correct Flow:

```txt
Open App
→ Direct Home Feed
→ User watches videos freely
→ User clicks:
   - Like
   - Comment
   - Subscribe
   - Upload
→ Show Login Modal
→ Login with Google
→ Continue Action
```

Exactly like YouTube.

---

# 🌍 PUBLIC FEATURES (WITHOUT LOGIN)

These should work without login:

```txt
- Home Feed
- Shorts Feed
- Search Videos
- Watch Videos
- View Channels
- Read Comments
- Trending
- Explore
- Categories
```

---

# 🔒 LOGIN REQUIRED FEATURES

When user tries these actions:

```txt
- Like Video
- Comment
- Subscribe
- Upload Video
- Create Channel
- Save Playlist
- Watch History Sync
- Notifications
```

Show Login Modal.

---

# 🔐 AUTHENTICATION SYSTEM

## Login Methods

- Google Login
- Email OTP (optional later)

---

# 🔑 AUTH FLOW

Use:

```bash
expo-auth-session
```

Backend Flow:

```txt
Google Login
→ Verify Google Token
→ Create JWT
→ Save User
→ Return Auth Token
```

---

# 👤 USER MODEL

```js
{
  (name,
    email,
    avatar,
    subscribersCount,
    subscribedChannels,
    watchHistory,
    likedVideos,
    role,
    createdAt);
}
```

---

# 🎥 VIDEO MODEL

```js
{
  (title,
    description,
    thumbnail,
    videoUrl,
    owner,
    views,
    likes,
    commentsCount,
    category,
    tags,
    visibility,
    duration,
    createdAt);
}
```

---

# 💬 COMMENT MODEL

```js
{
  (user, video, text, likes, replies);
}
```

---

# 🔔 SUBSCRIPTION MODEL

```js
{
  (subscriber, channel);
}
```

---

# 📂 PLAYLIST MODEL

```js
{
  (owner, name, videos, isPrivate);
}
```

---

# 📱 APP NAVIGATION STRUCTURE

# Bottom Tabs

```txt
Home
Shorts
Upload
Subscriptions
Library
```

---

# 📌 STACK SCREENS

```txt
VideoScreen
ChannelScreen
SearchScreen
CommentsScreen
LoginModal
UploadScreen
EditProfile
Settings
PlaylistScreen
```

---

# 🎬 VIDEO PLAYER SYSTEM

Use:

```bash
expo-av
```

Features:

```txt
- Auto Play
- Pause/Resume
- Fullscreen
- Double Tap Like
- Seek Bar
- Mini Player
- Recommended Videos
```

---

# ☁️ VIDEO STORAGE SYSTEM

## Recommended: Cloudinary

Why?

```txt
- Easy setup
- CDN support
- Video compression
- Thumbnail generation
- Fast delivery
```

---

# 📤 VIDEO UPLOAD FLOW

```txt
Pick Video
→ Upload to Cloudinary
→ Get URL
→ Save in MongoDB
```

---

# 📡 BACKEND API STRUCTURE

# AUTH ROUTES

```txt
POST /api/auth/google
GET /api/auth/me
```

---

# VIDEO ROUTES

```txt
GET /api/videos
GET /api/videos/:id
POST /api/videos/upload
PUT /api/videos/:id
DELETE /api/videos/:id
```

---

# COMMENT ROUTES

```txt
POST /api/comments
GET /api/comments/:videoId
DELETE /api/comments/:id
```

---

# SUBSCRIPTION ROUTES

```txt
POST /api/subscriptions/:channelId
GET /api/subscriptions/me
```

---

# LIKE ROUTES

```txt
POST /api/likes/video/:id
POST /api/likes/comment/:id
```

---

# 📂 FRONTEND APP STRUCTURE

```txt
app/
├── (tabs)/
│   ├── home/
│   ├── shorts/
│   ├── upload/
│   ├── subscriptions/
│   └── library/
│
├── video/
├── channel/
├── auth/
└── search/
```

---

# 🧠 STATE MANAGEMENT

Use Redux Toolkit.

Store Structure:

```txt
auth
video
comments
subscriptions
player
upload
theme
```

---

# 📦 REQUIRED PACKAGES

# BACKEND PACKAGES

```bash
npm install express mongoose cors dotenv bcryptjs jsonwebtoken multer cloudinary cookie-parser helmet morgan
```

---

# FRONTEND PACKAGES

```bash
npx expo install expo-av expo-image-picker expo-auth-session expo-secure-store react-native-reanimated react-native-gesture-handler
```

```bash
npm install axios @reduxjs/toolkit react-redux
```

---

# 🚀 DEVELOPMENT PHASES

# ✅ PHASE 1 — BACKEND SETUP

Tasks:

```txt
1. Setup Express Server
2. Connect MongoDB
3. Create Folder Structure
4. Setup JWT Auth
5. Setup Google Login
6. Create Models
7. Create APIs
8. Setup Cloudinary Upload
9. Setup Environment Variables
10. Setup Validation System
```

---

# ✅ PHASE 2 — EXPO APP SETUP

Tasks:

```txt
1. Create Expo App
2. Setup Expo Router
3. Setup Redux Toolkit
4. Setup Bottom Tabs
5. Setup Theme System
6. Create Reusable Components
7. Create Home UI
8. Create Video Card
9. Setup API Services
10. Setup Environment Variables
```

---

# ✅ PHASE 3 — VIDEO SYSTEM

```txt
1. Video Player
2. Watch Screen
3. Shorts Feed
4. Recommended Videos
5. Views Counter
```

---

# ✅ PHASE 4 — AUTHENTICATION

```txt
1. Google Login
2. Auth Modal
3. Protected Actions
4. Persist Login
```

---

# ✅ PHASE 5 — UPLOAD SYSTEM

```txt
1. Pick Video
2. Upload Thumbnail
3. Upload to Cloudinary
4. Save Video
5. Edit/Delete Video
```

---

# ✅ PHASE 6 — SOCIAL FEATURES

```txt
1. Likes
2. Comments
3. Subscribe
4. Playlist
5. Watch History
```

---

# ✅ PHASE 7 — OPTIMIZATION

```txt
1. Improve Performance
2. Reduce Re-renders
3. Optimize APIs
4. Cache Videos
5. Optimize Images
```

---

# 🚫 FUTURE FEATURES (DO NOT IMPLEMENT NOW)

Prepare scalable architecture only.

Do NOT implement these now:

```txt
- Live Streaming
- Monetization
- Super Chat
- Analytics
- Creator Dashboard
- Studio App
- Advanced Notifications
- AI Recommendations
```

---

# 📋 EXECUTION FLOW

VERY IMPORTANT

Tell:

```txt
Build project phase-by-phase.

After each phase:
1. Explain what was created
2. Show updated folder structure
3. Show dependencies used
4. Then move to next phase

Never generate complete app in one response.
```

---

# 📌 RECOMMENDED BUILD ORDER

```txt
1. Backend APIs
2. Authentication
3. Home Feed
4. Video Player
5. Upload System
6. Social Features
7. Optimization
```

---

# 🧠 FINAL MASTER INSTRUCTION FOR

```txt
You are building a production-grade scalable YouTube clone named Bideo.

Frontend:
- Expo React Native
- TypeScript
- Redux Toolkit
- Expo Router

Backend:
- Node.js
- Express
- MongoDB

Theme:
- White + Orange
- Clean Modern UI
- Mobile-first experience

Architecture Rules:
- Clean Architecture
- Reusable Components
- Modular APIs
- Production-ready folder structure
- Mobile-first optimization
- Proper .env management
- Scalable architecture
- Optimized performance

Important UX:
- App opens directly on Home Feed
- Login screen should NOT be first screen
- Login required only for actions:
  Like, Comment, Subscribe, Upload

Important:
- Build only current MVP features
- Do NOT implement future features now
- Prepare scalable architecture only

Build everything phase-by-phase only.
Do not generate everything together.
Always use scalable production-grade architecture.
```

---

# 🎯 FINAL GOAL

Build a scalable mobile-first YouTube-like application called:

# 🇮🇳 Bideo

Features:

```txt
✅ Video Watching
✅ Shorts
✅ Like/Comment
✅ Subscribe
✅ Share
✅ Upload Videos
✅ Public/Private Videos
✅ Google Login
✅ Channel System
✅ Playlist System
✅ Search
✅ Recommendations
✅ Watch History
✅ Mobile Optimized UI
```

---

# 🚀 FINAL ARCHITECTURE

```txt
Frontend (Expo React Native)
        ↓
REST APIs
        ↓
Node.js Backend
        ↓
MongoDB + Cloudinary
```
