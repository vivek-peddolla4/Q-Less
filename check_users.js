const mongoose = require('mongoose');
const User = require('./backend/models/User');
const bcrypt = require('bcrypt');

mongoose.connect('mongodb://127.0.0.1:27017/qless').then(async () => {
  try {
    const users = await User.find({});
    console.log('\n=== Users in Database ===');
    if (users.length === 0) {
      console.log('No users found in database');
    } else {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. Email: ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);
      });
    }
    process.exit(0);
  } catch (err) {
    console.log('Error fetching users:', err.message);
    process.exit(1);
  }
});
