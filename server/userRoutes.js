const express = require('express');
const router = express.Router();
const { run, get } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "super-secret-key-for-jwt"; // Should be from environment variables

// User Registration
router.post('/register', async (req, res) => {
    try {
        let { name, email, password } = req.body;
        // Normalize input to reduce false-positive conflicts
        if (typeof email === 'string') {
            email = email.trim().toLowerCase();
        }
        if (typeof name === 'string') {
            name = name.trim();
        }
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }

        const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
        console.log('[REGISTER] email:', email, 'existingUser:', existingUser?.id || null);
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 8);
        const result = await run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword]);

        console.log('[REGISTER] created user id:', result.id);
        res.status(201).json({ message: 'User registered successfully', data: { id: result.id, name, email } });
    } catch (err) {
        console.error('[REGISTER][ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// User Login
router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        if (typeof email === 'string') {
            email = email.trim().toLowerCase();
        }
        console.log('Login attempt for email:', email);
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await get('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
        console.log('User found:', user ? user.email : 'None');
        if (!user) {
            console.log('Invalid credentials: User not found');
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        console.log('Password match result:', isMatch);
        if (!isMatch) {
            console.log('Invalid credentials: Password mismatch');
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Login successful', data: { token, user: { id: user.id, name: user.name, email: user.email } } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
