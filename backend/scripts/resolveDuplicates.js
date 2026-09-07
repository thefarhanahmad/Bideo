const mongoose = require('mongoose');
require('dotenv').config();

const formatToValidUsername = (baseStr, suffix) => {
  let clean = (baseStr || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!clean) clean = 'user';
  return `${clean}_${suffix}`.slice(0, 25);
};

async function resolveDuplicates(dryRun = true) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../models/User');

    console.log(`====================================================`);
    console.log(`  DUPLICATE RESOLUTION SCRIPT (${dryRun ? 'DRY-RUN PREVIEW' : 'LIVE EXECUTION'})`);
    console.log(`====================================================\n`);

    const allUsers = await User.find({}, { name: 1, phone: 1, channelName: 1, createdAt: 1, channelNameEditCount: 1 }).sort({ createdAt: 1 });

    // 1. Resolve duplicate Display Names / Usernames (name)
    const nameMap = new Map();
    for (const u of allUsers) {
      const key = (u.name || '').trim().toLowerCase();
      if (!key) continue;
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key).push(u);
    }

    let nameUpdatesCount = 0;
    console.log('--- 1. USERNAMES (name) RESOLUTION ---');
    for (const [key, users] of nameMap.entries()) {
      if (users.length <= 1) continue;

      console.log(`\nDuplicate Group for name: "${key}" (${users.length} users):`);
      console.log(`  [ORIGINAL KEPT] ID: ${users[0]._id} | "${users[0].name}" (Phone: ${users[0].phone || 'N/A'}, Created: ${users[0].createdAt.toISOString()})`);

      for (let i = 1; i < users.length; i++) {
        const u = users[i];
        const newUsername = formatToValidUsername(u.name, i + 1);
        console.log(`  [UPDATE NEEDED] ID: ${u._id} | "${u.name}" -> "${newUsername}" (Phone: ${u.phone || 'N/A'}, Created: ${u.createdAt.toISOString()})`);

        if (!dryRun) {
          await User.updateOne({ _id: u._id }, { $set: { name: newUsername } });
        }
        nameUpdatesCount++;
      }
    }

    if (nameUpdatesCount === 0) {
      console.log('No duplicate usernames found.');
    }

    // 2. Resolve duplicate Channel Names (channelName)
    const channelMap = new Map();
    for (const u of allUsers) {
      const key = (u.channelName || '').trim().toLowerCase();
      if (!key) continue;
      if (!channelMap.has(key)) channelMap.set(key, []);
      channelMap.get(key).push(u);
    }

    let channelUpdatesCount = 0;
    console.log('\n--- 2. CHANNEL NAMES (channelName) RESOLUTION ---');
    for (const [key, users] of channelMap.entries()) {
      if (users.length <= 1) continue;

      console.log(`\nDuplicate Group for channel: "${key}" (${users.length} users):`);
      console.log(`  [ORIGINAL KEPT] ID: ${users[0]._id} | "${users[0].channelName}" (Phone: ${users[0].phone || 'N/A'}, Created: ${users[0].createdAt.toISOString()})`);

      for (let i = 1; i < users.length; i++) {
        const u = users[i];
        const newChannel = formatToValidUsername(u.channelName, i + 1);
        console.log(`  [UPDATE NEEDED] ID: ${u._id} | "${u.channelName}" -> "${newChannel}" (Phone: ${u.phone || 'N/A'}, Created: ${u.createdAt.toISOString()})`);

        if (!dryRun) {
          await User.updateOne(
            { _id: u._id },
            { 
              $set: { 
                channelName: newChannel,
                channelNameEditCount: 0
              } 
            }
          );
        }
        channelUpdatesCount++;
      }
    }

    if (channelUpdatesCount === 0) {
      console.log('No duplicate channel names found.');
    }

    console.log('\n================================================================================');
    console.log('                          📊 RESOLUTION SUMMARY COUNTS                          ');
    console.log('================================================================================');
    console.log(`  Total Users in Database      : ${allUsers.length}`);
    console.log(`  Duplicate Names Resolved     : ${nameUpdatesCount}`);
    console.log(`  Duplicate Channels Resolved  : ${channelUpdatesCount}`);
    console.log(`  Execution Mode               : ${dryRun ? 'DRY-RUN (No changes applied)' : 'LIVE (Updated in MongoDB)'}`);
    console.log('================================================================================\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Migration error:', err);
  }
}

const isApply = process.argv.includes('--apply');
resolveDuplicates(!isApply);
