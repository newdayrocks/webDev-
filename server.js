const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

console.log('Starting server...');
console.log('Current directory:', __dirname);

// Add unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('Attempting MySQL connection...');

// First connect without database
const initialConnection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1Bfeizq@G7a'
});

initialConnection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');

    // Create database
    initialConnection.query('CREATE DATABASE IF NOT EXISTS login_system', (err) => {
        if (err) {
            console.error('Error creating database:', err);
            return;
        }
        console.log('Database created or already exists');
        
        // Close initial connection
        initialConnection.end();

        // Connect to the specific database
        const db = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '1Bfeizq@G7a',
            database: 'login_system'
        });

        // Add connection error handler
        db.on('error', (err) => {
            console.error('Database error:', err);
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                console.error('Database connection was closed.');
            }
            if (err.code === 'ER_CON_COUNT_ERROR') {
                console.error('Database has too many connections.');
            }
            if (err.code === 'ECONNREFUSED') {
                console.error('Database connection was refused.');
            }
        });

        db.connect((err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                return;
            }
            console.log('Connected to login_system database');

            // Create users table
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            db.query(createTableQuery, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    return;
                }
                console.log('Users table created or already exists');
            });
        });

        // Signup endpoint
        app.post('/api/signup', async (req, res) => {
            const { username, email, password } = req.body;

            try {
                // Check if email already exists
                const [existing] = await db.promise().query('SELECT * FROM users WHERE email = ?', [email]);
                if (existing.length > 0) {
                    return res.status(400).json({ message: 'Email already exists' });
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Insert new user
                await db.promise().query(
                    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                    [username, email, hashedPassword]
                );

                res.status(201).json({ message: 'User created successfully' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Server error' });
            }
        });

        // Login endpoint
        app.post('/api/login', async (req, res) => {
            const { email, password } = req.body;

            try {
                // Find user by email
                const [users] = await db.promise().query('SELECT * FROM users WHERE email = ?', [email]);
                if (users.length === 0) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }

                const user = users[0];
                const validPassword = await bcrypt.compare(password, user.password);

                if (!validPassword) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }

                res.json({ 
                    message: 'Login successful',
                    user: { id: user.id, username: user.username, email: user.email }
                });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Server error' });
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port or stop the existing process.`);
    }
});