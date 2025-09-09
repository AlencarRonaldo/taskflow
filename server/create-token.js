const jwt = require('jsonwebtoken');
const JWT_SECRET = "super-secret-key-for-jwt";

// Create a token for user ID 1
const token = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET);
console.log('JWT Token:', token);

// Test creating a public access token
const fetch = require('node-fetch');

async function createPublicToken() {
  try {
    const response = await fetch('http://localhost:8000/api/boards/1/public-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ expiresIn: 24 })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Public Token Result:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log('Error:', error);
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

createPublicToken();