/**
 * Bideo Video Engagement Boost Script
 * Adds random views (100 - 300) and random likes with 100/7 ratio (~7%) to videos in database
 * Run via: node scripts/boostEngagement.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Video = require("../models/Video");
const User = require("../models/User");
const MonetizationApplication = require("../models/MonetizationApplication");

const boostEngagement = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      console.error("❌ Error: MONGO_URI not found in .env");
      process.exit(1);
    }

    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected successfully.\n");

    const [videos, users, monetizedApps] = await Promise.all([
      Video.find(),
      User.find().select("_id name"),
      MonetizationApplication.find({ status: "approved" }).select("user"),
    ]);

    if (!videos.length) {
      console.log("ℹ️ No videos found in the database.");
      process.exit(0);
    }

    const monetizedUserSet = new Set(
      monetizedApps.map((app) => app.user.toString())
    );

    console.log(`📹 Found ${videos.length} videos.`);
    console.log(`💎 Found ${monetizedUserSet.size} approved monetized creators.`);
    console.log(`Starting engagement boost...\n`);

    const userIds = users.map((u) => u._id);
    let totalViewsAdded = 0;
    let totalLikesAdded = 0;
    let totalEarningsCredited = 0;
    let monetizedVideosCount = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const previousViews = video.views || 0;
      const previousLikes = (video.likes || []).length;

      // 1. Random views between 100 and 300
      const addedViews = Math.floor(Math.random() * (300 - 100 + 1)) + 100;

      // 2. 100:7 ratio -> ~7% (between 6.2% and 7.8% natural jitter)
      const ratio = 0.07 + (Math.random() * 0.016 - 0.008);
      const targetLikesCount = Math.max(1, Math.round(addedViews * ratio));

      // 3. Populate likes with unique IDs
      const existingLikesSet = new Set((video.likes || []).map((id) => id.toString()));
      let likesAddedThisVideo = 0;

      const shuffledUserIds = [...userIds].sort(() => 0.5 - Math.random());
      for (const uid of shuffledUserIds) {
        if (likesAddedThisVideo >= targetLikesCount) break;
        if (!existingLikesSet.has(uid.toString())) {
          video.likes.push(uid);
          existingLikesSet.add(uid.toString());
          likesAddedThisVideo += 1;
        }
      }

      while (likesAddedThisVideo < targetLikesCount) {
        const syntheticId = new mongoose.Types.ObjectId();
        video.likes.push(syntheticId);
        likesAddedThisVideo += 1;
      }

      video.views = previousViews + addedViews;
      await video.save({ validateBeforeSave: false });

      totalViewsAdded += addedViews;
      totalLikesAdded += likesAddedThisVideo;

      // 4. If creator is monetized, credit ₹0.10 to their wallet!
      let earnedNotice = "";
      if (video.owner && monetizedUserSet.has(video.owner.toString())) {
        await User.findByIdAndUpdate(video.owner, {
          $inc: { walletBalance: 0.10, totalEarnings: 0.10 },
        });
        totalEarningsCredited += 0.10;
        monetizedVideosCount += 1;
        earnedNotice = " | 💰 Credited +₹0.10 to creator wallet";
      }

      console.log(
        `[${i + 1}/${videos.length}] "${video.title?.slice(0, 30)}..."` +
        ` | Views: ${previousViews} -> ${video.views} (+${addedViews})` +
        ` | Likes: ${previousLikes} -> ${video.likes.length} (+${likesAddedThisVideo})` +
        earnedNotice
      );
    }

    console.log("\n==========================================");
    console.log("🎉 Engagement & Monetization Boost Completed!");
    console.log(`📊 Total Videos Updated      : ${videos.length}`);
    console.log(`👁️ Total Views Added         : +${totalViewsAdded.toLocaleString("en-IN")}`);
    console.log(`❤️ Total Likes Added         : +${totalLikesAdded.toLocaleString("en-IN")}`);
    console.log(`📈 Average Ratio Applied      : ~7.0% (100 views : 7 likes)`);
    console.log(`💰 Monetized Videos Boosted   : ${monetizedVideosCount}`);
    console.log(`💵 Total Wallet Funds Added  : +₹${totalEarningsCredited.toFixed(2)} (₹0.10 per monetized video)`);
    console.log("==========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Boost Failed:", error);
    process.exit(1);
  }
};

boostEngagement();
