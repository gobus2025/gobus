/**
 * Test script to demonstrate API functionality
 * Run with: node test-api.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test functions
async function testAPI() {
  try {
    console.log('🚌 Testing GoBus API...\n');

    // 1. Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data.message);
    console.log('');

    // 2. Register a new user
    console.log('2. Registering a new user...');
    const registerData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123',
      role: 'user'
    };

    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      console.log('✅ User registered:', registerResponse.data.data.user.name);
      console.log('Token received:', registerResponse.data.data.token.substring(0, 20) + '...');
      
      const userToken = registerResponse.data.data.token;
      console.log('');

      // 3. Register an admin user
      console.log('3. Registering an admin user...');
      const adminData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'AdminPass123',
        role: 'admin'
      };

      const adminResponse = await axios.post(`${BASE_URL}/auth/register`, adminData);
      console.log('✅ Admin registered:', adminResponse.data.data.user.name);
      const adminToken = adminResponse.data.data.token;
      console.log('');

      // 4. Create a bus (admin only)
      console.log('4. Creating a bus (admin only)...');
      const busData = {
        busNumber: 'BUS001',
        route: {
          from: 'New York',
          to: 'Boston'
        },
        capacity: 40,
        fare: 25.50,
        departureTime: '08:00',
        arrivalTime: '12:00',
        operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        busType: 'AC',
        amenities: ['WiFi', 'Charging Point'],
        driver: {
          name: 'Mike Johnson',
          license: 'DL123456',
          phone: '1234567890'
        }
      };

      const busResponse = await axios.post(`${BASE_URL}/buses`, busData, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ Bus created:', busResponse.data.data.bus.busNumber);
      const busId = busResponse.data.data.bus._id;
      console.log('');

      // 5. Search for buses
      console.log('5. Searching for buses...');
      const searchResponse = await axios.get(`${BASE_URL}/buses/search`, {
        params: {
          from: 'New York',
          to: 'Boston',
          date: '2024-01-15'
        }
      });
      console.log('✅ Found buses:', searchResponse.data.data.buses.length);
      console.log('');

      // 6. Create a booking
      console.log('6. Creating a booking...');
      const bookingData = {
        busId: busId,
        passengerDetails: [
          {
            name: 'John Doe',
            age: 30,
            gender: 'male',
            seatNumber: 'A1'
          }
        ],
        travelDate: '2024-01-15',
        paymentMethod: 'card',
        contactInfo: {
          phone: '1234567890',
          email: 'john@example.com'
        }
      };

      const bookingResponse = await axios.post(`${BASE_URL}/bookings`, bookingData, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      console.log('✅ Booking created:', bookingResponse.data.data.booking.bookingId);
      console.log('Total amount:', '$' + bookingResponse.data.data.booking.totalAmount);
      console.log('');

      console.log('🎉 All tests completed successfully!');
      console.log('\n📋 API is working correctly. You can now:');
      console.log('- Use Postman or similar tools to test endpoints');
      console.log('- Build a frontend application to consume this API');
      console.log('- Check the server logs for detailed information');

    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        console.log('ℹ️  User already exists, trying to login instead...');
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
          email: 'john@example.com',
          password: 'Password123'
        });
        console.log('✅ Login successful:', loginResponse.data.data.user.name);
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    console.log('\n🔍 Make sure the server is running on port 5000');
    console.log('Run: npm start');
  }
}

// Run tests
testAPI();