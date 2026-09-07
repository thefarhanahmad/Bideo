const mongoose = require('mongoose');
require('dotenv').config();

async function analyzeDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../models/User');

    console.log('--- USERS TOTAL COUNT ---');
    const total = await User.countDocuments();
    console.log('Total users in DB:', total);

    console.log('\n--- DUPLICATE NAMES (case-insensitive & trimmed) ---');
    const allUsers = await User.find({}, { name: 1, phone: 1, channelName: 1, createdAt: 1, email: 1, authProvider: 1 }).lean();

    const nameMap = new Map();
    const channelMap = new Map();

    for (const u of allUsers) {
      const cleanName = (u.name || '').trim().toLowerCase();
      if (cleanName) {
        if (!nameMap.has(cleanName)) {
          nameMap.set(cleanName, []);
        }
        nameMap.get(cleanName).push(u);
      }

      const cleanChannel = (u.channelName || '').trim().toLowerCase();
      if (cleanChannel) {
        if (!channelMap.has(cleanChannel)) {
          channelMap.set(cleanChannel, []);
        }
        channelMap.get(cleanChannel).push(u);
      }
    }

    const duplicateNames = [];
    for (const [name, users] of nameMap.entries()) {
      if (users.length > 1) {
        duplicateNames.push({ name, count: users.length, users });
      }
    }
    duplicateNames.sort((a, b) => b.count - a.count);

    console.log(`Found ${duplicateNames.length} duplicate name groups (affecting ${duplicateNames.reduce((acc, g) => acc + g.count, 0)} total users):`);
    duplicateNames.forEach((g, idx) => {
      console.log(`\n[Group ${idx + 1}] Name: "${g.name}" (Count: ${g.count})`);
      g.users.forEach((u, i) => {
        console.log(`   ${i + 1}. ID: ${u._id} | DisplayName: "${u.name}" | Phone: ${u.phone || 'N/A'} | Channel: ${u.channelName || 'none'} | Provider: ${u.authProvider} | Created: ${u.createdAt?.toISOString()}`);
      });
    });

    const duplicateChannels = [];
    for (const [channel, users] of channelMap.entries()) {
      if (users.length > 1) {
        duplicateChannels.push({ channel, count: users.length, users });
      }
    }
    duplicateChannels.sort((a, b) => b.count - a.count);

    console.log(`\n--- DUPLICATE CHANNEL NAMES ---`);
    console.log(`Found ${duplicateChannels.length} duplicate channel name groups:`);
    duplicateChannels.forEach((g, idx) => {
      console.log(`\n[Group ${idx + 1}] Channel: "${g.channel}" (Count: ${g.count})`);
      g.users.forEach((u, i) => {
        console.log(`   ${i + 1}. ID: ${u._id} | DisplayName: "${u.name}" | Phone: ${u.phone || 'N/A'} | Channel: "${u.channelName}" | Created: ${u.createdAt?.toISOString()}`);
      });
    });

    const phoneMap = new Map();
    for (const u of allUsers) {
      const cleanPhone = (u.phone || '').trim();
      if (cleanPhone) {
        if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
        phoneMap.get(cleanPhone).push(u);
      }
    }
    const duplicatePhones = [...phoneMap.entries()].filter(([k, v]) => v.length > 1);

    const emailMap = new Map();
    for (const u of allUsers) {
      const cleanEmail = (u.email || '').trim().toLowerCase();
      if (cleanEmail) {
        if (!emailMap.has(cleanEmail)) emailMap.set(cleanEmail, []);
        emailMap.get(cleanEmail).push(u);
      }
    }
    const duplicateEmails = [...emailMap.entries()].filter(([k, v]) => v.length > 1);

    console.log('\n================================================================================');
    console.log('                          📊 DATABASE SUMMARY COUNTS                            ');
    console.log('================================================================================');
    console.log(`  Total Users in Database      : ${allUsers.length}`);
    console.log(`  Duplicate Name Groups        : ${duplicateNames.length} groups (affecting ${duplicateNames.reduce((a, b) => a + b.count, 0)} users)`);
    console.log(`  Duplicate Channel Groups     : ${duplicateChannels.length} groups (affecting ${duplicateChannels.reduce((a, b) => a + b.count, 0)} users)`);
    console.log(`  Duplicate Phone Groups       : ${duplicatePhones.length} groups`);
    console.log(`  Duplicate Email Groups       : ${duplicateEmails.length} groups`);
    console.log('================================================================================\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error analyzing duplicates:', err);
  }
}

analyzeDuplicates();
