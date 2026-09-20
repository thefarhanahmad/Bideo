const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const mongoose = require('mongoose');
const MonetizationApplication = require('../models/MonetizationApplication');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const User = require('../models/User');
const { checkAndApproveMonetization } = require('../utils/monetizationScheduler');

const run = async () => {
  try {
    await connectDB();

    console.log('\n--- 1. CURRENT PENDING MONETIZATION APPLICATIONS ---');
    const pendingApps = await MonetizationApplication.find({ status: 'pending' })
      .populate('user', 'name channelName email')
      .lean();

    console.log(`Total Pending Applications: ${pendingApps.length}`);

    const now = Date.now();
    for (const app of pendingApps) {
      const ageHours = ((now - new Date(app.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1);
      const ageDays = (ageHours / 24).toFixed(1);
      const passedCount = await VideoMonetizationReview.countDocuments({
        user: app.user?._id || app.user,
        status: 'passed',
      });
      const eligible = Number(ageHours) >= 48 && passedCount >= 3;

      console.log(`- User: ${app.name || app.user?.name} (@${app.user?.channelName || 'N/A'})`);
      console.log(`  Submitted At: ${new Date(app.createdAt).toISOString()} (${ageHours} hrs ago / ${ageDays} days ago)`);
      console.log(`  Passed Videos: ${passedCount}/3`);
      console.log(`  Eligible for 48h Auto-Approval? ${eligible ? '✅ YES' : (Number(ageHours) < 48 ? '⏳ NO (Under 48 hours)' : '❌ NO (Needs at least 3 passed videos)')}`);
      console.log('----------------------------------------------------');
    }

    console.log('\n--- 2. RUNNING checkAndApproveMonetization() NOW ---');
    await checkAndApproveMonetization();

    console.log('\n--- 3. STATUS AFTER RUNNING AUTO-APPROVAL ---');
    const remainingPending = await MonetizationApplication.countDocuments({ status: 'pending' });
    const totalApproved = await MonetizationApplication.countDocuments({ status: 'approved' });
    console.log(`Remaining Pending Applications: ${remainingPending}`);
    console.log(`Total Approved Applications: ${totalApproved}`);

    await mongoose.disconnect();
    console.log('\nDatabase connection closed. Finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error in runner:', err);
    process.exit(1);
  }
};

run();
