/**
 * Production Migration Script: Standardize All Usernames to Valid Unique Structure
 * 
 * Rules:
 * 1. Replaces spaces with underscores (e.g. "bideo team" -> "bideo_team")
 * 2. Lowercase and strips non-permitted characters (keeps only [a-z0-9._])
 * 3. Enforces length between 3 and 30 characters
 * 4. Resolves collisions by appending numerical suffixes: _2, _3, etc. (first user keeps base username)
 * 5. Handles edge cases: email handles (removes @domain), non-latin characters (uses channelName or user ID fallback)
 * 
 * Usage:
 *   node scripts/standardizeUsernames.js         (Dry-run preview, no DB changes)
 *   node scripts/standardizeUsernames.js --apply (Applies changes to database)
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

function cleanToUsername(rawName, fallbackChannel, userId) {
  let str = (rawName || '').trim().toLowerCase();

  // If email (e.g. test@gmail.com), use the portion before @
  if (str.includes('@')) {
    str = str.split('@')[0];
  }

  // Replace spaces and hyphens with underscores
  str = str.replace(/[\s\-]+/g, '_');

  // Keep only letters, numbers, dots, underscores
  str = str.replace(/[^a-z0-9._]/g, '');

  // Collapse consecutive dots and underscores
  str = str.replace(/_{2,}/g, '_').replace(/\.{2,}/g, '.');
  str = str.replace(/^[._]+|[._]+$/g, '');

  // If empty (e.g. non-latin script like Urdu/Arabic/emojis), fallback to channelName
  if (!str && fallbackChannel) {
    str = fallbackChannel.trim().toLowerCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^a-z0-9._]/g, '')
      .replace(/_{2,}/g, '_')
      .replace(/^[._]+|[._]+$/g, '');
  }

  // If still empty, use user_ + last 4 chars of ObjectId
  if (!str) {
    str = 'user_' + userId.toString().slice(-4);
  }

  // Ensure minimum length of 3 characters
  if (str.length < 3) {
    str = (str + '_user').slice(0, 30);
  }

  // Ensure maximum length of 30 characters
  if (str.length > 30) {
    str = str.slice(0, 30).replace(/^[._]+|[._]+$/g, '');
  }

  return str;
}

async function runMigration() {
  const isApply = process.argv.includes('--apply');
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment!');
    process.exit(1);
  }

  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected successfully.\n');

    console.log('================================================================================');
    console.log(`  STANDARDIZE USERNAMES MIGRATION (${isApply ? '🚀 LIVE EXECUTION' : '🔍 DRY-RUN PREVIEW'})`);
    console.log('================================================================================\n');

    const User = require('../models/User');

    // Fetch all users sorted by registration date (first come, first served)
    const users = await User.find({}, { name: 1, channelName: 1, phone: 1, email: 1, createdAt: 1 })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`Found ${users.length} total users in the database.\n`);

    const assignedUsernames = new Map(); // username -> userId
    const updates = [];
    let unchangedCount = 0;

    for (const u of users) {
      const base = cleanToUsername(u.name, u.channelName, u._id);
      let finalUsername = base;
      let counter = 2;

      // Handle duplicate usernames by appending _2, _3, etc.
      while (assignedUsernames.has(finalUsername)) {
        const candidate = `${base}_${counter}`.slice(0, 30);
        finalUsername = candidate;
        counter++;
      }

      assignedUsernames.set(finalUsername, u._id);

      const isChanged = u.name !== finalUsername;

      if (isChanged) {
        updates.push({
          userId: u._id,
          originalName: u.name,
          newUsername: finalUsername,
          phone: u.phone || 'N/A',
          channelName: u.channelName || 'N/A',
          createdAt: u.createdAt,
        });
      } else {
        unchangedCount++;
      }
    }

    console.log('--------------------------------------------------------------------------------');
    console.log(`PLANNED USERNAME UPDATES (${updates.length} users to update, ${unchangedCount} already match):`);
    console.log('--------------------------------------------------------------------------------');

    updates.forEach((item, idx) => {
      console.log(
        `${String(idx + 1).padStart(2, ' ')}. [${item.userId}] "${item.originalName}" -> "${item.newUsername}" (Phone: ${item.phone})`
      );
    });

    if (isApply) {
      console.log('\n⏳ Applying updates to database in bulk...');
      const bulkOps = updates.map((item) => ({
        updateOne: {
          filter: { _id: item.userId },
          update: { $set: { name: item.newUsername } },
        },
      }));

      if (bulkOps.length > 0) {
        const result = await User.bulkWrite(bulkOps);
        console.log(`✅ Successfully updated ${result.modifiedCount} user(s) in MongoDB.`);
      } else {
        console.log('ℹ️ No updates needed.');
      }
    } else {
      console.log('\n💡 DRY-RUN complete. No changes were made to the database.');
      console.log('To apply these changes live, run:');
      console.log('   node scripts/standardizeUsernames.js --apply\n');
    }

    await mongoose.disconnect();
    console.log('🔌 Database disconnected.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
