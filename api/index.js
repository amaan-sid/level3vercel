const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const url = require('url');

// SQLite DB path (relative to current function)
const DB_PATH = path.join(db, 'todos.db');

// Helper to connect to SQLite
function connectToDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

// Create todos table
function createTodosTable(db) {
    return new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            completed INTEGER DEFAULT 0
        )`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Read request body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(err);
            }
        });
    });
}

// Main handler
module.exports = async (req, res) => {
    try {
        const db = await connectToDatabase();
        await createTodosTable(db);

        const { method } = req;
        const parsedUrl = url.parse(req.url, true);
        const idMatch = parsedUrl.pathname.match(/^\/api\/(\d+)$/);
        const isItemRoute = idMatch !== null;
        const todoId = isItemRoute ? parseInt(idMatch[1]) : null;

        // GET /api
        if (method === 'GET' && parsedUrl.pathname === '/api') {
            db.all('SELECT * FROM todos', (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(200).json({ todos: rows });
            });
        }

        // POST /api
        else if (method === 'POST' && parsedUrl.pathname === '/api') {
            const body = await parseBody(req);
            const { title } = body;
            if (!title) return res.status(400).json({ error: 'Title is required' });

            db.run('INSERT INTO todos (title) VALUES (?)', [title], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ id: this.lastID, title });
            });
        }

        // PUT /api/:id
        else if (method === 'PUT' && isItemRoute) {
            const body = await parseBody(req);
            const { title, completed } = body;
            db.run('UPDATE todos SET title = ?, completed = ? WHERE id = ?', [title, completed, todoId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Todo not found' });
                res.status(200).json({ id: todoId, title, completed });
            });
        }

        // DELETE /api/:id
        else if (method === 'DELETE' && isItemRoute) {
            db.run('DELETE FROM todos WHERE id = ?', [todoId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Todo not found' });
                res.status(200).json({ message: 'Todo deleted successfully' });
            });
        }

        // Not found
        else {
            res.status(404).json({ error: 'Route not found' });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
