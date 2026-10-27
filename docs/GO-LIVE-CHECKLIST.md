# Bideo — go-live checklist (27 Oct 2026)

Everything below is already built, tested and merged into `production` (`0abc00a`).
**Nothing is live yet.** The live server still runs `bad2c88` (24 Oct).

---

## 1. Cloudflare: allow admin uploads straight to R2 (5 minutes)

Needed only for the **admin dashboard's normal upload page** (the app does not need it).
Without it nothing breaks: the admin page automatically falls back to the old upload
(old 100 MB limit).

1. Cloudflare dashboard → **R2** → open the Bideo bucket → **Settings**
2. **CORS Policy** → **Add CORS policy** → paste:

```json
[
  {
    "AllowedOrigins": ["https://bideo.in", "https://www.bideo.in"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Save. (No lifecycle rule needed: the server cancels unfinished uploads itself, hourly.)

---

## 2. Test locally before going live

Run the backend against a **local test database** (never the live one) and a test build of
the app on a real phone. Check:

- [ ] Log in, close the app, reopen — still logged in
- [ ] Search (e.g. "hindi song") — relevant videos come first
- [ ] Home feed — pinned videos + 1 random video at the top, different on refresh
- [ ] Switch account: add 2+ accounts, "Add Account" visible above the phone's bottom bar
- [ ] Sticky banner ads: Channel Analytics, Followers/Following, History, Liked, Your Videos
      (bottom) and Edit Channel (top, under the header)
- [ ] Watch a video for 1+ minute — the "+1 🪙 coin" pill appears
- [ ] Upload from the app: a small video, a video over 100 MB, and one where you switch the
      internet off half-way, then tap Upload again (it should continue, not restart)
- [ ] Upload from the admin dashboard: normal page (shows %), and the "Server only" page
- [ ] Upload 3 kinds of video from the app and check they play on the phone and on bideo.in:
      a WhatsApp / downloaded video (uploads the original, no compression), a camera recording
      (compressed as before) and, on an iPhone, a camera video (compressed as before)
- [ ] A video longer than 17 minutes shows its real length (e.g. 23:18, not 0:01)
- [ ] Log out — the upload screens show "Sign In / Sign Up"

Tell Claude the screen and what you see if anything looks wrong.

**Testing uploads locally**
- Direct upload needs the R2 keys (`R2_*`) in your local `backend/.env`. Without them the app
  and admin simply use the old upload (that is the fallback working, not a bug).
- With the keys, test videos go to the real R2 bucket: delete them from the admin dashboard
  after testing.
- The admin dashboard on `http://localhost:5173` uses the old upload unless you also add
  `"http://localhost:5173"` to `AllowedOrigins` in the CORS rule (section 1). Remove it again
  after testing if you like.

---

## 3. Deploy the server

1. Note the version to go back to if needed: **`bad2c88`**
2. Free some disk first (safe, removes only unused Docker items):
   `docker image prune -f && docker builder prune -f`
3. **App logins last 30 days instead of 7** (decided 27 Oct): in `/root/Bideo/backend/.env` set
   `JWT_EXPIRE=30d` (currently `7d`). Takes effect with this deploy. Logins made before keep
   their 7 days; active users move to 30 days within a day through the daily renewal.
4. `cd /root/Bideo && ./deploy.sh`
5. Check straight away:
   - [ ] bideo.in loads, admin login works
   - [ ] the **current** app (old version) logs in, plays videos, searches
   - [ ] `docker logs --tail 100 bideo-backend` — no errors
6. Fix the length of long videos uploaded before this deploy (369 were already fixed on 27 Oct;
   the old server kept saving new long uploads wrong until now):
   `docker compose exec backend node scripts/repairVideoDurations.js` (shows what it would
   change), then the same with `--apply`. It reads the real length from each video file and
   only changes wrong ones; running it again is safe.
7. If something is wrong: go back to `bad2c88` and run `deploy.sh` again.

Optional settings in `backend/.env` (defaults are fine):

| Setting | Default | What it does |
|---|---|---|
| `DIRECT_UPLOAD_MAX_MB` | 2048 | Biggest video for the new upload (MB) |
| `MAX_RECOMMENDED_PUSHES_PER_DAY` | 10 | "Recommended" pushes per person per day |
| `FORGOT_PASSWORD_GUIDE_VIDEO_URL` | not set | Shows the "Watch Video Guide" button on forgot password |

What happens by itself on the first start: the new search index builds (seconds), the 8 AM
push sender and the hourly upload clean-up start.

## 4. Release the app

After the server has run fine for a day: `eas build --profile production --platform android`
and publish. Older app versions keep working with the new server.

## 5. Watch for 1–2 days

Ask Claude to check: errors in the logs, upload failures, push volume, disk space.

---

## 6. Security (please do soon)

- [ ] **Change the root password** of the Bideo server (`passwd`) — it was shared in chat
- [ ] **Change the admin password** — the old one is in `credentials.txt` and in git history
- [ ] App login secret is still the default `supersecretkey` (`JWT_SECRET`) — anyone can fake
      a login. Needs a careful change so nobody is logged out
- [ ] Password reset: the reset code is sent back to the app and `1234` always works — anyone
      with a phone number can reset that account. Needs an SMS service
- [ ] Google login is not verified on the server
- [ ] Remove Claude's SSH key from the server when the work is done

## 7. Later (not urgent)

- [ ] Move the remaining old videos to R2 (~86 GB still on the server disk, 8.8 GB free).
      The script is ready: `/root/bideo-migrate.js` (moves oldest first, checks every file,
      log in `/root/bideo-migration/`). Ask Claude to run it.
- [ ] Use a custom domain for media (e.g. `media.bideo.in`) instead of the `pub-….r2.dev`
      link — Cloudflare limits the `r2.dev` link and does not recommend it for production
- [ ] Videos without a thumbnail point to `via.placeholder.com` (service is gone) — they show
      a blank thumbnail; small server fix
- [ ] Chat list: stop reloading all chats on every message (step 1), then search and counts
      on the server (step 2)
- [ ] **Decide: duplicate usernames.** 625 users share 286 usernames (most from renaming on
      Edit Channel before this release's fix). Sign-in by username finds only one of them; the
      others must use their phone number. Option: after the deploy, rename the later accounts
      in each group with `_2`, `_3` (first account keeps its name), dry run first. Ask Claude.
- [ ] **Decide: admin boost rewards are not recorded.** The money reaches the creator's wallet,
      but its record is silently dropped (type `admin_boost` is not accepted). Fixing it makes
      boost rewards show in the earnings list and count in "today's earnings". Small server fix.

## 8. Clean-up on the server (when everything is fine)

- [ ] Old backups (the first one holds old secrets):
      `rm -r /root/adminauth-backup-20261021-1330 /var/www/bideo-prev-20261021-1344`
- [ ] Unused Docker leftovers (~850 MB): `docker image prune -f && docker builder prune -f`
- [ ] After the video move is finished: `/root/bideo-migrate.js`, `/root/bideo-migration/`
      (also holds the nginx backup from before the R2 redirect rule)
