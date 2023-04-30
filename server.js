//mongodb
require("./config/db");
const cors = require("cors");
const app = require("express")();
// const session = require("express-session");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

const UserRouter = require("./api/User");

//accept form data
const bodyParser = require("express").json();
app.use(bodyParser);
app.use(cors());
app.use("/user", UserRouter);

// const sessionMiddleware = session({
//   secret: "mysecretkey",
//   resave: false,
//   saveUninitialized: false,
//   cookie: { secure: false },
// });

// app.use(sessionMiddleware);

// // Set a session variable when the user logs in
// app.post('/login', (req, res) => {
//   req.session.isLoggedIn = true;
//   console.log("yes");
//   res.send('Logged in successfully!');
// });

// // Check if the user is logged in
// app.get('/checklogin', (req, res) => {
//   const isLoggedIn = req.session.isLoggedIn || false;
//   console.log(isLoggedIn);
//   res.send(`Logged in: ${isLoggedIn}`);
// });

// // Clear the session when the user logs out
// app.post('/logout', (req, res) => {
//   req.session.destroy(err => {
//     if (err) {
//       console.error(err);
//       console.log("error")
//       res.sendStatus(500);
//     } else {
//       console.log('logout')
//       res.send('Logged out successfully!');
//     }
//   });
// });

app.get("/hello", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// module.exports = sessionMiddleware;
