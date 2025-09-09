const jwt = require('jsonwebtoken');

const JWT_SECRET = "super-secret-key-for-jwt";

// Create token for user ID 2
const token = jwt.sign(
    { id: 2, email: "ronaldoalencar2009@hotmail.com" }, 
    JWT_SECRET, 
    { expiresIn: '1h' }
);

console.log('🔑 Test token for user 2:');
console.log(token);