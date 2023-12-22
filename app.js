const express = require('express');
const session = require('express-session');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const bodyParser = require('body-parser');
const chat = require('./chatbot.js')
require('dotenv').config();
const database = require("./database.js");

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
});


app.use(sessionMiddleware);

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

app.set('view engine', 'ejs');
app.use(express.static('./public'));

// Body Parser Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Passport session setup
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

// Use the FacebookStrategy within Passport
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'name', 'picture', 'email']
},
    function (accessToken, refreshToken, profile, done) {
        process.nextTick(function () {
            return done(null, profile);
        });
    }));

app.use(passport.initialize());
app.use(passport.session());

// Function to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}
// Function to check if user is not authenticated
function isNotAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// Logout Route
app.get('/logout', (req, res) => {
    req.logout(function (err) {
        if (err) {
            // handle error
            console.log(err);
            return next(err);
        }
        // Redirect after successful logout
        res.redirect('/login');
    });
});


// Login Route
app.get('/login', isNotAuthenticated, (req, res) => {
    res.render('login');

});

// Facebook authentication routes
app.get('/auth/facebook', isNotAuthenticated, passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/');
    });

// Chat interface for authenticated users
app.get('/', isAuthenticated, async (req, res) => {

    const userObject = {
        id: req.user.id,
        first_name: req.user.name.givenName,
        last_name: req.user.name.familyName,
        email: req.user.emails[0].value
    };

    // pass user object to DB for creation/login, returns 
    const databaseObject = await database.getUserOrCreate(userObject);

    res.render('chat', { user: databaseObject });
});

// Socket.IO for real-time chat
io.on('connection', async (socket) => {
    // Check if the user is authenticated
    if (socket.request.session && socket.request.session.passport && socket.request.session.passport.user) {

        userID = socket.request.session.passport.user.id;

        console.log('Authenticated user connected');

        socket.on('chat message', async (event) => {

            replyObject = {
                reply: event.message,
                sender: "client"
            }
            socket.emit('chat message', replyObject);

            summary = await database.getSummary(userID)

            reply = await chat.smartBot(event.message, event.character, event.denomination, userID, summary);

            replyObject = {
                reply: reply.content,
                sender: "bot"
            }

            database.updateUserCredit(userID, -reply.cost)

            if (reply.sumCount == 30) {

                summary = await database.getSummary(userID)
                efObject = await chat.extractFacts(userID, summary);
                database.updateUserCredit(userID, -efObject.cost, efObject.content)

            }

            socket.emit('chat message', replyObject);
        });

        socket.on('disconnect', async () => {

            summary = await database.getSummary(userID)
            efObject = await chat.extractFacts(userID, summary);

            console.log(efObject)

            if (efObject) {

                database.updateUserCredit(userID, -efObject.cost, efObject.content)
                chat.clearThread(userID);
            }
            console.log('User disconnected');
        });
    } else {
        console.log('Unauthenticated user attempted to connect');
        socket.disconnect(true); // Disconnect if not authenticated
    }
});

// Starting the server with the HTTP server instance
server.listen(3000, () => {
    console.log(`Server is running on port:3000`);
});
