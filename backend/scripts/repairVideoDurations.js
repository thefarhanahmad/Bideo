/**
 * Repair video durations saved wrong by the old "above 1000 = milliseconds" rule.
 *
 * The real length is read from each video file's own header (MP4 / MOV "mvhd"), not guessed:
 *   - local files under backend/uploads are read from disk
 *   - files on R2 are read with small HTTP range requests (only the header boxes)
 * Checked: durations above 1000 (old millisecond values), missing / zero durations, and
 * durations impossibly short for the file size (e.g. a 300 MB file saved as "2 seconds").
 * A video is changed only when its real length differs by at least a second, and only if the
 * stored value is still the one that was read (nothing changed meanwhile).
 * Shorts are not moved: long videos marked as Shorts are only counted in the report.
 *
 * Usage (dry run by default: writes the plan, changes nothing):
 *   docker compose exec backend node scripts/repairVideoDurations.js
 *   docker compose exec backend node scripts/repairVideoDurations.js --apply
 * Options: --out <dir> (default: the system temp folder), --limit <n>
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Video = require('../models/Video');
const { readMp4Duration } = require('../utils/mp4Duration');

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const LIMIT = Number(arg('--limit')) || Infinity;
const OUT = path.resolve(arg('--out') || path.join(os.tmpdir(), 'bideo-duration-repair'));
const UPLOADS = path.join(__dirname, '../uploads');
const MAX_BELIEVABLE_BITRATE = 16 * 1000 * 1000; // bits per second; above this the stored length is too short
const PARALLEL = 4;
const MIN_CHANGE_SECONDS = 1;

// A reader for the video file: local disk or HTTP range requests
const openSource = async (videoUrl) => {
  const local = /\/(?:api\/)?uploads\/(videos\/[A-Za-z0-9._-]+)$/.exec(String(videoUrl || '').split('?')[0]);
  if (local) {
    const file = path.join(UPLOADS, local[1]);
    if (fs.existsSync(file)) {
      const fd = fs.openSync(file, 'r');
      const size = fs.fstatSync(fd).size;
      return {
        kind: 'server disk',
        size,
        read: async (start, end) => {
          const buf = Buffer.alloc(end - start + 1);
          fs.readSync(fd, buf, 0, buf.length, start);
          return buf;
        },
        close: () => fs.closeSync(fd),
      };
    }
  }
  if (!/^https?:\/\//.test(String(videoUrl))) return null;
  const head = await fetch(videoUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const size = Number(head.headers.get('content-length'));
  if (!head.ok || !size) return null;
  return {
    kind: 'cloud',
    size,
    read: async (start, end) => {
      const res = await fetch(videoUrl, { headers: { Range: `bytes=${start}-${end}` }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (res.status !== 206) throw new Error(`range not supported (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },
    close: () => {},
  };
};

const reasonFor = (v) => {
  const d = Number(v.duration) || 0;
  if (d <= 0) return 'missing';
  if (d > 1000) return 'above 1000 (old milliseconds)';
  return 'too short for the file size';
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  fs.mkdirSync(OUT, { recursive: true });

  const shortLooking = await Video.find({ duration: { $gt: 0, $lte: 120 }, compressedVideoSize: { $gt: 0 } })
    .select('_id duration compressedVideoSize')
    .lean();
  const tooShortIds = shortLooking
    .filter((v) => (v.compressedVideoSize * 8) / v.duration > MAX_BELIEVABLE_BITRATE)
    .map((v) => v._id);
  const candidates = await Video.find({
    $or: [{ duration: { $gt: 1000 } }, { duration: { $lte: 0 } }, { duration: null }, { _id: { $in: tooShortIds } }],
  })
    .select('_id duration videoUrl isShort compressedVideoSize createdAt')
    .sort({ createdAt: -1 })
    .lean();
  const list = candidates.slice(0, LIMIT);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: checking ${list.length} videos`);

  const plan = [];
  const counts = { checked: 0, change: 0, alreadyRight: 0, unreadable: 0, changed: 0, skippedChangedMeanwhile: 0, longMarkedAsShort: 0 };
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const v = list[next++];
      counts.checked++;
      let source = null;
      try {
        source = await openSource(v.videoUrl);
        const real = source ? await readMp4Duration(source.read, source.size) : null;
        if (!real || !Number.isFinite(real) || real <= 0) {
          counts.unreadable++;
          continue;
        }
        const newDuration = Math.round(real * 100) / 100;
        if (v.isShort && newDuration > 60) counts.longMarkedAsShort++;
        if (Math.abs(newDuration - (Number(v.duration) || 0)) < MIN_CHANGE_SECONDS) {
          counts.alreadyRight++;
          continue;
        }
        counts.change++;
        const row = {
          id: String(v._id),
          oldDuration: v.duration ?? null,
          newDuration,
          reason: reasonFor(v),
          isShort: Boolean(v.isShort),
          fileMB: Math.round((source.size / 1048576) * 10) / 10,
          from: source.kind,
        };
        plan.push(row);
        if (APPLY) {
          const res = await Video.updateOne({ _id: v._id, duration: v.duration }, { $set: { duration: newDuration } });
          if (res.modifiedCount === 1) counts.changed++;
          else counts.skippedChangedMeanwhile++;
        }
      } catch {
        counts.unreadable++;
      } finally {
        if (source) source.close();
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const file = path.join(OUT, `${APPLY ? 'applied' : 'plan'}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
  fs.writeFileSync(file, plan.map((r) => JSON.stringify(r)).join('\n') + (plan.length ? '\n' : ''));
  console.log(JSON.stringify({ ...counts, list: file, samples: plan.slice(0, 8) }, null, 1));
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Duration repair failed:', err.message);
  process.exit(1);
});
