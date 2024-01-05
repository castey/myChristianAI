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

// redirect http req to https
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && process.env.IS_PRODUCTION == true) {
        res.redirect(`https://${req.header('host')}${req.url}`);
        console.log("redirect successful")
    } else {
        next();
    }
});

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
});

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

function logOauthRedirect(provider) {
    return function (req, res, next) {
        console.log(`Visitor directed to ${provider} Login`);
        next(); // Proceed to the next middleware
    };
}

// use middleWare for session secret
app.use(sessionMiddleware);
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// use ejs rendering
app.set('view engine', 'ejs');

// serve public files
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

// Facebook authentication routes
app.get('/auth/facebook', isNotAuthenticated, logOauthRedirect("Facebook"), passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/');
    }
);

// Chat interface for authenticated users
app.get('/', isAuthenticated, async (req, res) => {

    let userObject

    if (req.user.emails) {
        userObject = {
            id: req.user.id,
            first_name: req.user.name.givenName,
            last_name: req.user.name.familyName,
            email: req.user.emails[0].value
        };
    }

    else {

        userObject = {
            id: req.user.id,
            first_name: req.user.name.givenName,
            last_name: req.user.name.familyName,
            email: "none found"
        };
    }
    // pass user object to DB for creation/login, returns 
    const databaseObject = await database.getUserOrCreate(userObject);

    res.render('chat', { user: databaseObject });
});

// Login Route
app.get('/login', isNotAuthenticated, (req, res) => {
    console.log("Login page accessed!")
    res.render('login');

});

// Logout Route
app.get('/logout', (req, res) => {
    console.log(`User logged out: ${req.user.id}`)
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

// ToS endpoint
app.get("/terms-of-service", (req, res) => {
    res.render('terms')
});

// privacy policy endpoint
app.get("/privacy-policy", (req, res) => {
    res.render('policy')
});

app.post("/delete-data", isAuthenticated, async (req, res) => {
    await database.deleteUser(req.user.id)
    return res.redirect('/logout');
})

app.get("/contact", (req, res) => {
    res.render('contact', { success: "Contact" })
})

app.post("/contact-submit", async (req, res) => {
    if (req && req.body && req.body.message) {
        console.log(req.body.message)
        await database.saveContactMessage(req.body.message + "\nsent by: " + req.body.email)
        res.render('contact', { success: "Message Sent!" })
        //send email
    }
})

app.post("/download-data", isAuthenticated, async (req, res) => {
    try {
        // Retrieve data
        let userData = await database.getAllUserData(req.user.id);

        // Convert data to JSON format (if not already in JSON format)
        let jsonData = JSON.stringify(userData);

        // Set headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename=user-data.json');
        res.setHeader('Content-Type', 'application/json');

        // Send the data
        res.send(jsonData);
    } catch (error) {
        // Handle any errors
        console.error("Error fetching user data:", error);
        res.status(500).send("An error occurred while fetching user data.");
    }
});

app.post("/settings-submit", isAuthenticated, async (req, res) => {
    try {
        // Extract data from the request body
        const { favoriteDenomination, email } = req.body;
        const userID = req.user.id; // Assuming the user ID is stored in req.user.id

        // Input validation (basic example)
        if (!email || !favoriteDenomination) {
            // Handle invalid input - redirect back with an error message
            return res.redirect('/settings?error=Missing required fields');
        }

        // Validate email format (simple regex example)
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            // Handle invalid email format - redirect back with an error message
            return res.redirect('/settings?error=Invalid email format');
        }

        console.log(`Settings updated: ${userID}`)
        // Update favorite denomination
        await database.updateUserData(userID, "favorite", favoriteDenomination);

        // Update email
        await database.updateUserData(userID, "email", email);

        // Redirect back to settings with a success message
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});


// settings endpoint
app.get("/settings", isAuthenticated, async (req, res) => {

    let email = await database.getUserData(req.user.id, "email");
    let favorite = await database.getUserData(req.user.id, "favorite");

    let databaseObject = {
        email: email,
        favorite: favorite
    }

    console.log(`Settings page accessed: ${req.user.id}`)

    res.render('settings', { user: databaseObject })

})

// Socket.IO for real-time chat
io.on('connection', async (socket) => {
    // Check if the user is authenticated
    if (socket.request.session && socket.request.session.passport && socket.request.session.passport.user) {

        let userID = socket.request.session.passport.user.id;

        favoriteDenom = await database.getUserData(userID, "favorite");

        if (favoriteDenom == "" || !favoriteDenom) favoriteDenom = "christian";

        socket.emit("favDenom", favoriteDenom);

        console.log('User opened chat: ' + userID);

        socket.on('chat message', async (event) => {

            let replyObject

            replyObject = {
                reply: event.message,
                sender: "client"
            }
            socket.emit('chat message', replyObject);

            let summary = await database.getSummary(userID)

            if (event.message == "") {

                replyObject = {
                    reply: "You can't send an empty message.",
                    sender: "bot"
                }
            }

            else {
                let reply = await chat.smartBot(event.message, event.character, event.denomination, userID, summary);
                if (!reply){
                    console.log("reply object not found!")
                }
                if (reply && reply.images) {

                    replyObject = {
                        images: reply.images,
                        sender: "bot"
                    }

                }

                else if(reply && reply.content){
                    replyObject = {
                        reply: reply.content,
                        sender: "bot"
                    }
                }

                else{
                    console.log("Reply ERROR! ")
                    console.log(reply)
                    replyObject = {
                        reply: "Looks like there was an issue with the server, let's pray it gets fixed soon!",
                        sender: "bot"
                    }
                }
                if (reply && reply.cost && reply.cost > 0) {
                    database.updateUserCredit(userID, -reply.cost)
                }

                if (reply.sumCount == 30) {

                    summary = await database.getSummary(userID)

                    // extractFacts is only passed summary because it has access to the threads[userID] object inside chat module
                    efObject = await chat.extractFacts(userID, summary);
                    database.updateUserCredit(userID, -efObject.cost, efObject.content)

                }
            }
            socket.emit('chat message', replyObject);
        });

        socket.on('disconnect', async () => {

            // grab the summary from the database
            summary = await database.getSummary(userID)

            // extractFacts only processes and returns an object if a threads[userID] object has been created
            efObject = await chat.extractFacts(userID, summary);

            if (efObject) {

                database.updateUserCredit(userID, -efObject.cost, efObject.content)
                chat.clearThread(userID);
            }
            console.log('User closed chat: ' + userID);
        });
    } else {
        console.log('Unauthenticated user attempted to connect');
        socket.disconnect(true); // Disconnect if not authenticated
    }
});

// Starting the server with the HTTP server instance
server.listen(process.env.PORT, () => {
    console.log(`Server is running on port:${process.env.PORT}`);
});
