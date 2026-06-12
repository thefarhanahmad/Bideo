const Video = require("../models/Video");
const User = require("../models/User");
const Follower = require("../models/Follower");
const VideoView = require("../models/VideoView");
const VideoReport = require("../models/VideoReport");
const Notification = require("../models/Notification");
const cloudinary = require("cloudinary").v2;
const { deleteFromCloudinary } = require("../utils/cloudinary");

const FALLBACK_THUMBNAIL =
  "https://via.placeholder.com/640x360.png?text=Tube+India";

const formatDefaultTitle = () =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags;
  if (!tags || typeof tags !== "string") return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const normalizeOptionalValue = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null")
      return undefined;
    return trimmed;
  }
  return value;
};

const isNineBySixteen = (aspectRatio) => {
  if (!aspectRatio) return false;
  const target = 9 / 16;
  return Math.abs(aspectRatio - target) <= 0.035;
};

const applyVideoTypeFilter = (query, type) => {
  if (type === "short") query.isShort = true;
  if (type === "video" || type === "long") query.isShort = { $ne: true };
  return query;
};

const getVideoQuery = (req, onlyPublic = false) => {
  const query = { visibility: "public" };
  if (req.query.owner) query.owner = req.query.owner;
  return applyVideoTypeFilter(query, req.query.type);
};

const getSort = (sort) => {
  if (sort === "popular") return { views: -1, createdAt: -1 };
  return { createdAt: -1 };
};

const decorateVideos = async (videos, req) => {
  let results = videos.map((v) => v.toObject());
  if (!req.user) return results;

  const user = await User.findById(req.user.id);
  results = results.map((v) => ({
    ...v,
    isLiked: v.likes
      ? v.likes.some((id) => id.toString() === req.user.id.toString())
      : false,
    isDisliked: v.dislikes
      ? v.dislikes.some((id) => id.toString() === req.user.id.toString())
      : false,
    isFollowing:
      user && user.followingChannels && v.owner
        ? user.followingChannels.some(
            (id) => id.toString() === v.owner._id.toString(),
          )
        : false,
  }));
  return results;
};

const createNotification = async ({
  recipient,
  actor,
  type,
  video,
  comment,
  message,
}) => {
  if (!recipient || !actor || recipient.toString() === actor.toString()) return;
  await Notification.create({
    recipient,
    actor,
    type,
    video,
    comment,
    message,
  });
};

exports.searchVideos = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json({ success: true, count: 0, data: [] });

    const videos = await Video.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ],
      visibility: "public",
    })
      .populate("owner", "name avatar channelName followersCount")
      .populate("category", "name")
      .sort("-createdAt");

    const results = await decorateVideos(videos, req);
    res
      .status(200)
      .json({ success: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getVideos = async (req, res, next) => {
  try {
    const videos = await Video.find(getVideoQuery(req))
      .populate("owner", "name avatar channelName followersCount")
      .populate("category", "name")
      .sort(getSort(req.query.sort));

    const results = await decorateVideos(videos, req);
    res
      .status(200)
      .json({ success: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate("owner", "name avatar channelName followersCount")
      .populate("category", "name");

    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    if (video.visibility !== "public") {
      const isOwner =
        req.user &&
        video.owner &&
        video.owner._id &&
        video.owner._id.toString() === req.user.id.toString();
      const isAdmin = req.user && req.user.role === "admin";
      if (!isOwner && !isAdmin) {
        return res
          .status(404)
          .json({ success: false, message: "Video not found" });
      }
    }

    const [videoData] = await decorateVideos([video], req);
    res.status(200).json({ success: true, data: videoData });
  } catch (err) {
    next(err);
  }
};

exports.recordView = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });

    const userId = req.user?._id;
    const deviceId = req.headers["x-device-id"] || req.body.deviceId;
    if (!userId && !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Device id is required for anonymous views",
      });
    }

    try {
      await VideoView.create({
        video: video._id,
        user: userId || undefined,
        deviceId: userId ? undefined : String(deviceId),
      });
      video.views += 1;
      await video.save();
    } catch (err) {
      if (err.code !== 11000) throw err;
    }

    res.status(200).json({ success: true, views: video.views });
  } catch (err) {
    next(err);
  }
};

exports.getFollowedVideos = async (req, res, next) => {
  try {
    const followings = await Follower.find({ follower: req.user.id });
    const channelIds = followings.map((f) => f.channel);
    const query = applyVideoTypeFilter(
      { owner: { $in: channelIds }, visibility: "public" },
      req.query.type,
    );

    const videos = await Video.find(query)
      .populate("owner", "name avatar channelName followersCount")
      .populate("category", "name")
      .sort("-createdAt");

    const results = await decorateVideos(videos, req);
    res
      .status(200)
      .json({ success: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getMyVideos = async (req, res, next) => {
  try {
    const query = applyVideoTypeFilter({ owner: req.user.id }, req.query.type);
    const videos = await Video.find(query)
      .populate("owner", "name avatar channelName")
      .populate("category", "name")
      .sort("-createdAt");
    res.status(200).json({ success: true, count: videos.length, data: videos });
  } catch (err) {
    next(err);
  }
};

exports.toggleLike = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });

    const userId = req.user.id.toString();
    const alreadyLiked = video.likes.some((id) => id.toString() === userId);
    if (alreadyLiked) {
      video.likes = video.likes.filter((id) => id.toString() !== userId);
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { likedVideos: video._id },
      });
    } else {
      video.likes.addToSet(req.user.id);
      video.dislikes = video.dislikes.filter((id) => id.toString() !== userId);
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { likedVideos: video._id },
      });
      await createNotification({
        recipient: video.owner,
        actor: req.user.id,
        type: "video_like",
        video: video._id,
        message: `${req.user.channelName || req.user.name} liked your video`,
      });
    }

    await video.save();
    res.status(200).json({
      success: true,
      likes: video.likes,
      dislikes: video.dislikes,
      isLiked: !alreadyLiked,
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleDislike = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });

    const userId = req.user.id.toString();
    if (video.dislikes.some((id) => id.toString() === userId)) {
      video.dislikes = video.dislikes.filter((id) => id.toString() !== userId);
    } else {
      video.dislikes.addToSet(req.user.id);
      video.likes = video.likes.filter((id) => id.toString() !== userId);
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { likedVideos: video._id },
      });
    }

    await video.save();
    res
      .status(200)
      .json({ success: true, likes: video.likes, dislikes: video.dislikes });
  } catch (err) {
    next(err);
  }
};

exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.files || !req.files.video || !req.files.video[0]) {
      return res
        .status(400)
        .json({ success: false, message: "Please upload a video file" });
    }

    const uploadType = req.body.uploadType === "short" ? "short" : "video";
    const videoResult = await cloudinary.uploader.upload(
      req.files.video[0].path,
      {
        resource_type: "video",
        folder: "bideo/videos",
      },
    );

    const width = Number(videoResult.width || 0);
    const height = Number(videoResult.height || 0);
    const aspectRatio = width && height ? width / height : null;
    if (uploadType === "short" && !isNineBySixteen(aspectRatio)) {
      await deleteFromCloudinary(videoResult.secure_url, "video");
      return res.status(400).json({
        success: false,
        message: "Shorts must be portrait 9:16 videos",
      });
    }

    let thumbnail = FALLBACK_THUMBNAIL;
    if (req.files.thumbnail && req.files.thumbnail[0]) {
      const thumbnailResult = await cloudinary.uploader.upload(
        req.files.thumbnail[0].path,
        {
          folder: "bideo/thumbnails",
        },
      );
      thumbnail = thumbnailResult.secure_url;
    } else {
      thumbnail = cloudinary.url(`${videoResult.public_id}.jpg`, {
        resource_type: "video",
        start_offset: 1,
        width: 640,
        height: 360,
        crop: "fill",
        quality: "auto",
        secure: true,
      });

      console.log("Generated Thumbnail URL:", thumbnail);
    }

    const video = await Video.create({
      title: req.body.title || formatDefaultTitle(),
      description: req.body.description || "",
      category: req.body.category || undefined,
      tags: normalizeTags(req.body.tags),
      videoUrl: videoResult.secure_url,
      thumbnail: thumbnail || FALLBACK_THUMBNAIL,
      duration: videoResult.duration || 0,
      isShort: uploadType === "short",
      aspectRatio,
      owner: req.user.id,
      visibility: req.body.visibility || "public",
    });

    res.status(201).json({ success: true, data: video });
  } catch (err) {
    next(err);
  }
};

exports.updateVideo = async (req, res, next) => {
  try {
    let video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    if (video.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this video",
      });
    }

    const updates = {};
    ["title", "description", "category", "visibility"].forEach((key) => {
      const value = normalizeOptionalValue(req.body[key]);
      if (value !== undefined) updates[key] = value;
    });
    if (req.body.tags !== undefined)
      updates.tags = normalizeTags(req.body.tags);

    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      const thumbnailResult = await cloudinary.uploader.upload(
        req.files.thumbnail[0].path,
        {
          folder: "bideo/thumbnails",
        },
      );
      updates.thumbnail = thumbnailResult.secure_url;
      if (video.thumbnail) await deleteFromCloudinary(video.thumbnail, "image");
    }

    video = await Video.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({ success: true, data: video });
  } catch (err) {
    next(err);
  }
};

exports.reportVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    const reason = (req.body.reason || "").trim();
    if (!reason)
      return res
        .status(400)
        .json({ success: false, message: "Report reason is required" });

    const report = await VideoReport.findOneAndUpdate(
      { video: video._id, reporter: req.user.id },
      { reason, status: "open", updatedAt: Date.now() },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

exports.deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video)
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    if (video.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this video",
      });
    }

    if (video.videoUrl) await deleteFromCloudinary(video.videoUrl, "video");
    if (video.thumbnail) await deleteFromCloudinary(video.thumbnail, "image");

    await video.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
