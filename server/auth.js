const jwt = require('jsonwebtoken');
const JWT_SECRET = "super-secret-key-for-jwt"; // Em um app real, use variáveis de ambiente!

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    console.log('🔐 AUTH DEBUG:', { authHeader, token: token ? 'EXISTS' : 'MISSING' });

    if (!token) {
        console.log('❌ No token provided');
        return res.status(403).send({ message: 'No token provided!' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('❌ JWT verification failed:', err); // Log the full error object
            return res.status(401).send({ message: 'Unauthorized!' });
        }
        console.log('✅ JWT verified, user:', decoded);
        req.user = decoded; // Attach user payload to request
        next();
    });
};

module.exports = verifyToken;
