require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const adventureDb = require('./utils/adventureDb');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.FORMBAR_SESSION_SECRET || 'dev-adventure-secret-change-me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })
);

// Serve CSS and images (avoid mounting project root so index.html does not shadow /)
app.use('/style', express.static(path.join(__dirname, 'style')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/js', express.static(path.join(__dirname, 'public')));

// Expose current path to all views for nav highlighting
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});

app.use('/', require('./routes/index'));
app.use('/battles', require('./routes/battles'));
app.use('/terms', require('./routes/terms'));
app.use('/pucks', require('./routes/pucks'));
app.use('/slammers', require('./routes/slammers'));
app.use('/statuses', require('./routes/statuses'));
app.use('/zones', require('./routes/zones'));
app.use('/mart', require('./routes/mart'));
app.use('/pois', require('./routes/pois'));
app.use('/adventure', require('./routes/adventure'));

app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Not Found',
        message: 'That page could not be found.'
    });
});

adventureDb
    .init()
    .then(() => {
        // Warm Formbar socket in background (optional)
        try {
            const formbarSocket = require('./utils/formbarSocket');
            if (process.env.FORMBAR_ADDRESS && process.env.API_KEY) {
                formbarSocket.getSocket().catch((err) => {
                    console.warn('[FormbarSocket] Startup connect skipped:', err.message);
                });
            }
        } catch (err) {
            console.warn('[FormbarSocket] Not started:', err.message);
        }

        app.listen(PORT, () => {
            console.log(`PokeDex listening at http://localhost:${PORT}`);
            console.log(`Adventure Mode at http://localhost:${PORT}/adventure`);
        });
    })
    .catch((err) => {
        console.error('Failed to init adventure DB:', err);
        process.exit(1);
    });
