const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Create hashed passwords
    const adminPass = await bcrypt.hash('admin123', 10);
    const userPass  = await bcrypt.hash('user123', 10);

    // Insert users
    await User.insertMany([
      { username: 'admin', password: adminPass, role: 'admin' },
      { username: 'user',  password: userPass,  role: 'investigator' }
    ]);

    console.log('✅ Users seeded successfully!');
    console.log('   admin / admin123  →  Admin');
    console.log('   user  / user123   →  Investigator');

    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
};

seedUsers();