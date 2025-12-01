const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'leaderboard.db');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for base64 images
app.use(express.static(__dirname)); // Serve static files (index.html)

// Database Setup
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users/Entries table
        // We'll store individual logs. Aggregation happens on read or client.
        // Actually, to match previous logic, let's store logs and aggregate on client for now, 
        // or better: store logs and have an endpoint to get full state.
        
        // Let's create a table for logs directly.
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            calories INTEGER NOT NULL,
            proof TEXT, -- Base64 image
            date TEXT NOT NULL
        )`);

        // Meta table for last reset date
        db.run(`CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);
        
        // Initialize lastReset if not exists
        db.get("SELECT value FROM meta WHERE key = 'lastReset'", (err, row) => {
            if (!row) {
                const now = Date.now().toString();
                db.run("INSERT INTO meta (key, value) VALUES ('lastReset', ?)", [now]);
            }
        });
    });
}

// Routes

// Get all data (formatted for frontend)
app.get('/api/data', (req, res) => {
    const response = {
        users: [],
        lastReset: 0
    };

    db.serialize(() => {
        // Get Last Reset
        db.get("SELECT value FROM meta WHERE key = 'lastReset'", (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            response.lastReset = parseInt(row ? row.value : Date.now());

            // Get Logs
            db.all("SELECT * FROM logs", (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                // Aggregate logs into users array to match frontend expectation
                // Frontend expects: { name, totalCalories, logs: [] }
                const usersMap = {};

                rows.forEach(row => {
                    if (!usersMap[row.name]) {
                        usersMap[row.name] = {
                            name: row.name,
                            totalCalories: 0,
                            logs: []
                        };
                    }
                    usersMap[row.name].totalCalories += row.calories;
                    usersMap[row.name].logs.push({
                        date: row.date,
                        calories: row.calories,
                        proof: row.proof
                    });
                });

                response.users = Object.values(usersMap);
                res.json(response);
            });
        });
    });
});

// Add Entry
app.post('/api/entry', (req, res) => {
    const { name, calories, proof, date } = req.body;
    
    if (!name || !calories) {
        return res.status(400).json({ error: 'Name and calories required' });
    }

    const stmt = db.prepare("INSERT INTO logs (name, calories, proof, date) VALUES (?, ?, ?, ?)");
    stmt.run(name, calories, proof, date || new Date().toLocaleString(), function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: 'Entry added' });
    });
    stmt.finalize();
});

// Reset Data (Weekly Reset)
app.post('/api/reset', (req, res) => {
    const newResetDate = Date.now().toString();
    
    db.serialize(() => {
        // Archive logs? For now, just delete as per requirements "Reset all weekly data"
        db.run("DELETE FROM logs", (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            db.run("UPDATE meta SET value = ? WHERE key = 'lastReset'", [newResetDate], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Leaderboard reset', lastReset: parseInt(newResetDate) });
            });
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
