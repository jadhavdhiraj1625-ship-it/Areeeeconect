// backend/seed.js – MongoDB Atlas Database Seeder for AgriConnect
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const User = require('./models/User');
const Farm = require('./models/Farm');
const Surveyor = require('./models/Surveyor');
const Booking = require('./models/Booking');
const Candidate = require('./models/Candidate');
const Payment = require('./models/Payment');

const seedDatabase = async () => {
  console.log('🌱 Starting MongoDB Atlas Database Seeder...');
  
  const connected = await connectDB();
  if (!connected) {
    console.error('❌ Cannot seed database: Connection failed');
    process.exit(1);
  }

  try {
    console.log('🧹 Cleaning existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Farm.deleteMany({}),
      Surveyor.deleteMany({}),
      Booking.deleteMany({}),
      Candidate.deleteMany({}),
      Payment.deleteMany({})
    ]);

    const passwordHashDefault = await bcrypt.hash('password', 10);
    const passwordHashAdmin = await bcrypt.hash('admin', 10);
    const passwordHashS1 = await bcrypt.hash('s1', 10);

    console.log('👤 Seeding platform users...');
    const users = await User.create([
      {
        name: 'Operations Admin',
        email: 'admin@agriconnect.in',
        mobile: 'admin',
        passwordHash: passwordHashAdmin,
        role: 'admin',
        status: 'active'
      },
      {
        name: 'Rohit Bhamare',
        email: 'rohit@example.com',
        mobile: '8625098532',
        passwordHash: passwordHashDefault,
        role: 'farmer',
        status: 'active'
      },
      {
        name: 'Baldev Singh',
        email: 'baldev@example.com',
        mobile: '9988776655',
        passwordHash: passwordHashDefault,
        role: 'farmer',
        status: 'active'
      },
      {
        name: 'Gaurav Khadse',
        email: 'gaurav@gmail.com',
        mobile: '7276025116',
        passwordHash: passwordHashDefault,
        role: 'surveyor',
        status: 'active'
      },
      {
        name: 'Ramesh Kumar',
        email: 'ramesh@gmail.com',
        mobile: '9876543210',
        passwordHash: passwordHashDefault,
        role: 'surveyor',
        status: 'active'
      },
      {
        name: 'Demo S1',
        email: 's1@agriconnect.in',
        mobile: 's1',
        passwordHash: passwordHashS1,
        role: 'surveyor',
        status: 'active'
      },
      {
        name: 'Amit Deshmukh',
        email: 'amit@gmail.com',
        mobile: '9100229988',
        passwordHash: passwordHashDefault,
        role: 'candidate',
        status: 'active'
      },
      {
        name: 'Priya Sharma',
        email: 'priya@gmail.com',
        mobile: '9500123456',
        passwordHash: passwordHashDefault,
        role: 'candidate',
        status: 'active'
      }
    ]);

    const farmerRohit = users[1];
    const farmerBaldev = users[2];
    const surveyorGaurav = users[3];
    const surveyorRamesh = users[4];
    const surveyorS1 = users[5];
    const candidateAmit = users[6];
    const candidatePriya = users[7];

    console.log('📐 Seeding surveyor profiles...');
    const surveyors = await Surveyor.create([
      {
        userId: surveyorGaurav._id,
        employeeId: 'AGR-2026-001',
        name: 'Gaurav Khadse',
        baseStation: 'Chopda',
        taluka: 'chopda',
        status: 'available',
        rating: 4.8,
        jobsCompleted: 5
      },
      {
        userId: surveyorRamesh._id,
        employeeId: 'AGR-2026-002',
        name: 'Ramesh Kumar',
        baseStation: 'Thalner',
        taluka: 'thalner',
        status: 'available',
        rating: 4.9,
        jobsCompleted: 12
      },
      {
        userId: surveyorS1._id,
        employeeId: 'AGR-2026-003',
        name: 'Demo S1',
        baseStation: 'Jalgaon',
        taluka: 'jalgaon',
        status: 'available',
        rating: 4.5,
        jobsCompleted: 3
      }
    ]);

    console.log('🌾 Seeding registered farm plots...');
    const farms = await Farm.create([
      {
        farmerId: farmerRohit._id,
        farmName: 'Plot 4-A, Khasra No. 112',
        village: 'Thalner',
        location: {
          address: 'Thalner, Near Canal Road',
          latitude: 21.0,
          longitude: 75.0
        },
        acreage: 3.5,
        contactNumber: '8625098532',
        surveyType: 'Boundary Tally',
        estimatedCost: 1750
      },
      {
        farmerId: farmerBaldev._id,
        farmName: 'Sunflower Estate Sector 2',
        village: 'Shirpur',
        location: {
          address: 'Shirpur Bypass Hub',
          latitude: 21.5,
          longitude: 75.3
        },
        acreage: 5.0,
        contactNumber: '9988776655',
        surveyType: 'Farm Subdivision',
        estimatedCost: 4000
      }
    ]);

    console.log('📋 Seeding candidate recruitment dossiers...');
    await Candidate.create([
      {
        userId: candidateAmit._id,
        fullName: 'Amit Deshmukh',
        email: 'amit@gmail.com',
        mobile: '9100229988',
        address: 'Near Station Road, Chopda',
        district: 'Jalgaon',
        preferredTaluka: 'chopda',
        qualification: 'B.Tech Civil Engineering',
        experienceYears: 1,
        licenseId: 'LIC-991122',
        applicationStatus: 'applied',
        interviewScore: null,
        backgroundCheck: { status: 'pending' }
      },
      {
        userId: candidatePriya._id,
        fullName: 'Priya Sharma',
        email: 'priya@gmail.com',
        mobile: '9500123456',
        address: 'Civil Lines, Shirpur',
        district: 'Dhule',
        preferredTaluka: 'shirpur',
        qualification: 'ITI Surveyor Certification',
        experienceYears: 2,
        licenseId: 'LIC-445566',
        applicationStatus: 'interview',
        interviewScore: null,
        backgroundCheck: { status: 'pending' },
        interviewSchedule: {
          date: '2026-09-02',
          time: '11:00 AM',
          meetingLink: 'https://meet.google.com/agr-surv-int'
        }
      }
    ]);

    console.log('📅 Seeding demo booking...');
    const demoBooking = await Booking.create({
      farmerId: farmerRohit._id,
      surveyorId: surveyors[0]._id,
      farmId: farms[0]._id,
      surveyType: 'Boundary Tally',
      area: 3.5,
      cost: 1750,
      distance: 15,
      status: 'Completed',
      appointmentDate: '2026-08-25',
      appointmentTime: '10:00 AM',
      preparationInstructions: 'Boundary markers installed.'
    });

    await Payment.create({
      bookingId: demoBooking._id,
      farmerId: farmerRohit._id,
      amount: 1750,
      invoiceNumber: 'INV-2026-0001',
      transactionId: 'TXN-9988112233',
      paymentMethod: 'UPI',
      status: 'paid',
      paidAt: new Date()
    });

    console.log('\n======================================================');
    console.log('✅ MongoDB Atlas Seed Completed Successfully!');
    console.log(`   • Database: ${mongoose.connection.name}`);
    console.log(`   • Users: ${users.length}`);
    console.log(`   • Surveyors: ${surveyors.length}`);
    console.log(`   • Farm Plots: ${farms.length}`);
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();
