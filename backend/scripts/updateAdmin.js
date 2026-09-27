const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function main() {
  const args = process.argv.slice(2);

  // Default credentials requested by you
  const DEFAULT_PHONE = '1234567891';
  const DEFAULT_PASSWORD = 'Bideo#admin@123';

  let targetPhone = DEFAULT_PHONE;
  let newPhone = DEFAULT_PHONE;
  let newPassword = DEFAULT_PASSWORD;

  if (args.length === 2) {
    // Usage: node scripts/updateAdmin.js <new_phone> <new_password>
    targetPhone = args[0];
    newPhone = args[0];
    newPassword = args[1];
  } else if (args.length >= 3) {
    // Usage: node scripts/updateAdmin.js <current_phone> <new_phone> <new_password>
    targetPhone = args[0];
    newPhone = args[1];
    newPassword = args[2];
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // Find admin: check for targetPhone, old test phone (9999999999), or any existing admin
  let admin = await User.findOne({ phone: targetPhone }).select('+password');

  if (!admin && targetPhone !== '9999999999') {
    admin = await User.findOne({ phone: '9999999999' }).select('+password');
  }

  if (!admin) {
    admin = await User.findOne({ role: 'admin' }).select('+password');
  }

  if (admin) {
    console.log(`Found existing admin account: "${admin.name}" (Current Phone: ${admin.phone || 'N/A'})`);

    // Check if new phone is already taken by someone else
    if (newPhone !== admin.phone) {
      const conflict = await User.findOne({ phone: newPhone, _id: { $ne: admin._id } });
      if (conflict) {
        console.error(`❌ Error: Phone ${newPhone} is already in use by user "${conflict.name}" (ID: ${conflict._id}).`);
        await mongoose.disconnect();
        process.exit(1);
      }
    }

    admin.phone = newPhone.trim();
    admin.password = newPassword;
    admin.role = 'admin';
    await admin.save();
  } else {
    console.log('No existing admin found. Creating a new admin account...');
    admin = new User({
      name: 'System Admin',
      phone: newPhone.trim(),
      password: newPassword,
      role: 'admin',
      isVerified: true
    });
    await admin.save();
  }

  // Verify password works
  const verifiedUser = await User.findById(admin._id).select('+password');
  const isMatch = await verifiedUser.matchPassword(newPassword);

  if (isMatch) {
    console.log('\n=============================================');
    console.log('🎉 SUCCESS: Admin credentials updated!');
    console.log(`📱 Phone   : ${verifiedUser.phone}`);
    console.log(`🔑 Password: ${newPassword}`);
    console.log(`👤 Name    : ${verifiedUser.name}`);
    console.log(`🛡️  Role    : ${verifiedUser.role}`);
    console.log('=============================================\n');
  } else {
    console.error('❌ Password verification failed.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
