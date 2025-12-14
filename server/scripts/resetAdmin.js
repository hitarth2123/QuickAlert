const mongoose = require('mongoose');

async function resetAdminPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alertnet_db');
    
    const User = require('../models/User');
    
    // Find admin
    const admin = await User.findOne({ email: 'admin@quickalert.com' }).select('+password');
    
    if (!admin) {
      console.log('Admin not found!');
      process.exit(1);
    }
    
    // Set password directly - the pre-save hook will hash it
    admin.password = 'Admin@123456';
    admin.role = 'super_admin';
    admin.isVerified = true;
    admin.isActive = true;
    admin.loginAttempts = 0;
    admin.lockUntil = undefined;
    
    await admin.save();
    
    console.log('Admin password reset successfully!');
    console.log('');
    console.log('=== ADMIN CREDENTIALS ===');
    console.log('Email: admin@quickalert.com');
    console.log('Password: Admin@123456');
    console.log('========================');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();
