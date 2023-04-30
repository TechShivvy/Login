const express = require("express");
const axios = require("axios");
const router = express.Router();
const cors = require("cors");
router.use(cors());

const User = require("./../models/User");

const UserVerification = require("./../models/UserVerification");

const Appointment = require("./../models/Appointment");

const UserAppointment = require("./../models/UserAppointment");

const nodemailer = require("nodemailer");

const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

const bcrypt = require("bcrypt");

const path = require("path");

const jwt = require("jsonwebtoken");

// const sessionMiddleware = require("../server");
// router.use(sessionMiddleware);
const session = require("express-session");

router.use(
  session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

const cookieParser = require("cookie-parser");
router.use(cookieParser());

const development = "http://localhost:5000/";
const production = "https://login-gwub.onrender.com/";
// const currentUrl = process.env.NODE_ENV ? production : development;
const currentUrl = 1? production : development;

let transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Ready for messages");
    console.log(success);
  }
});

function mergeSlots(allSlots) {
  // Sort the list by start time
  allSlots.sort((a, b) => a[0] - b[0]);
  console.log(allSlots);
  // Merge overlapping time slots
  let mergedSlots = [allSlots[0]];
  for (let i = 1; i < allSlots.length; i++) {
    let currentSlot = allSlots[i];
    let previousSlot = mergedSlots[mergedSlots.length - 1];
    if (currentSlot[0] <= previousSlot[1]) {
      previousSlot[1] = new Date(Math.max(previousSlot[1], currentSlot[1]));
    } else {
      mergedSlots.push(currentSlot);
    }
  }
  console.log(mergedSlots);
  return mergedSlots;
}

function availableSlots(offHours, date) {
  console.log(offHours);
  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  endOfDay.setDate(startOfDay.getDate() + 1);
  const availableHours = [];

  let start = startOfDay;
  for (let i = 0; i < offHours.length; i++) {
    const [offStart, offEnd] = offHours[i];
    const end = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth(),
      startOfDay.getDate(),
      offStart.getHours(),
      offStart.getMinutes()
    );

    if (start < end) {
      availableHours.push([start, end]);
    }

    start = new Date(2023, 3, 30, offEnd.getHours(), offEnd.getMinutes());
  }

  if (start < endOfDay) {
    availableHours.push([start, endOfDay]);
  }
  return availableHours;
}

router.post("/available", async (req, res) => {
  // async function calculateAvailableHours(guest_id, createdBy_id, date_chosen) {
  try {
    let { guest_id, createdBy_id, date_chosen } = req.body;

    date_chosen = new Date(date_chosen);
    console.log(date_chosen);

    // Get the guest and creator's off-hours schedules
    const [guest, creator] = await Promise.all([
      User.findById(guest_id).select({
        offHours: { $elemMatch: { day: "Monday" } },
      }),
      User.findById(createdBy_id).select({
        offHours: { $elemMatch: { day: "Monday" } },
      }),
    ]);

    console.log(guest.offHours);
    console.log(creator.offHours);

    const offHours = [...guest.offHours, ...creator.offHours];
    let slots = [];
    for (let i = 0; i < offHours.length; i++) {
      slots.push([offHours[i].start, offHours[i].end]);
    }

    // Get all appointments for the selected date for both users
    const userAppointments = await UserAppointment.find({
      userId: { $in: [guest_id, createdBy_id] },
    }).populate("appointmentId");

    const uniqueAppointmentIds = new Set();
    userAppointments.forEach((userAppointment) => {
      userAppointment.appointmentId.forEach((appointment) => {
        if (!uniqueAppointmentIds.has(appointment._id)) {
          if (appointment.start > date_chosen)
            slots.push([appointment.start, appointment.end]);
          uniqueAppointmentIds.add(appointment._id);
        }
      });
    });

    console.log(slots);

    // Extract appointment IDs without duplicates
    // const appointmentIds = [
    //   ...new Set(
    //     userAppointments.map(
    //       (userAppointment) => userAppointment.appointmentId._id
    //     )
    //   ),
    // ];

    // // Get all appointments by ID
    // const appointments = await Appointment.find({
    //   _id: { $in: appointmentIds },
    // });

    // for(let i=0;i<appointments.length;i++)
    // {
    //   slots.push([appointments[i].start,appointments[i].end]);
    //   console.log(appointments[i].start);
    // }

    slots = mergeSlots(slots);
    availableHours = availableSlots(slots, date_chosen);

    return res.json({ data: availableHours });
  } catch (err) {
    console.log(err);
    return res.json({
      status: "FAILED",
      message: "No users",
    });
  }
});

async function addUserAppointment(userId, appointmentId) {
  try {
    // Find the UserAppointment document for the given userId
    const userAppointment = await UserAppointment.findOne({ userId });

    if (!userAppointment) {
      // If no UserAppointment document exists for the given userId, create a new one
      const newUserAppointment = new UserAppointment({
        userId: userId,
        appointmentId: appointmentId,
      });

      await newUserAppointment.save();
    } else {
      // If a UserAppointment document already exists for the given userId, add the appointmentId to its array
      userAppointment.appointmentId.push(appointmentId);
      await userAppointment.save();
    }
    return { success: true };
  } catch (error) {
    console.error(error);
    return {
      status: "FAILED",
      message: "An error occured while pushing appointments",
    };
  }
}

router.post("/appointment", async (req, res) => {
  let { guest, title, agenda, start, end, createdBy } = req.body;
  const newAppointment = new Appointment({
    guest: guest, // a valid ObjectId for a User document
    title: title,
    agenda: agenda,
    start: new Date(start), // a valid UTC date and time
    end: new Date(end), // a valid UTC date and time
    createdBy: createdBy, // a valid ObjectId for a User document
  });

  try {
    const savedAppointment = await newAppointment.save();
    console.log(savedAppointment);

    await addUserAppointment(guest, savedAppointment._id);
    await addUserAppointment(createdBy, savedAppointment._id);

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({
      status: "FAILED",
      message: "An error occured while scheduling appointment",
    });
  }
});

router.post("/off-hours", async (req, res) => {
  try {
    // const { userId } = req.params;
    const { email, day, start, end } = req.body;

    // Check if user exists
    // const user = await User.findById(userId);
    const user = await User.find({ email });
    console.log(user);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // if (!user.offHours) {
    //   user.offHours = []; // Manually initialize to an empty array if undefined
    // }
    // Add new off hour
    user[0].offHours.push({ day, start, end });
    await user[0].save();

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/off-hours", async (req, res) => {
  try {
    // const { userId } = req.params;
    const { email, offHoursId } = req.body;

    // Check if user exists
    // const user = await User.findById(userId);
    const user = await User.find({ email });
    console.log(user);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // if (!user.offHours) {
    //   user.offHours = []; // Manually initialize to an empty array if undefined
    // }
    // Add new off hour
    user[0].offHours.pull({ _id: offHoursId });
    await user[0].save();

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

const authenticateUser = (req, res, next) => {
  console.log(req.headers.authorization);
  const token = req.headers.authorization?.split(" ")[1];
  console.log(req.cookies.isLoggedIn);
  console.log(token);
  if (!token) {
    console.log("here1");
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    jwt.verify(token, process.env.SECRET_KEY);
    console.log("here2");
    next();
  } catch (error) {
    console.log("here3");
    return res.status(401).json({ message: "Invalid token" });
  }
};

router.post("/profile", authenticateUser, async (req, res) => {
  console.log(req.session.isLoggedIn);
  const token = req.headers.authorization?.split(" ")[1];
  const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
  const email = decodedToken.email;
  console.log(email);
  await User.find({ email })
    .then((data) => {
      console.log(data);
      if (data.length) {
        console.log("yes");
        res.json({
          status: "SUCCESS",
          message: "Record fetched!",
          data: data,
          offHours: data[0].offHours
        });
      } else {
        res.json({
          status: "FAILED",
          message: "No users",
        });
      }
    })
    .catch((err) => {
      res.json({
        status: "FAILED",
        message: "An error occured while checking for existing user",
      });
    });
});

// router.get("/getData", (req, res) => {
//   res.send("hello");
// });

//signup
router.post("/signup", (req, res) => {
  let { name, email, password, dateOfBirth } = req.body;

  name = name.trim();
  email = email.trim();
  password = password.trim();
  dateOfBirth = dateOfBirth.trim();

  if (name == "" || email == "" || password == "" || dateOfBirth == "") {
    res.json({
      status: "FAILED",
      message: "Empty input fields!",
    });
  } else if (!/^[a-zA-Z ]*$/.test(name)) {
    res.json({
      status: "FAILED",
      message: "Inavlid name entered!",
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    res.json({
      status: "FAILED",
      message: "Inavlid email entered!",
    });
  } else if (!new Date(dateOfBirth).getTime()) {
    res.json({
      status: "FAILED",
      message: "Inavlid DOB entered!",
    });
  } else if (password.length < 8) {
    res.json({
      status: "FAILED",
      message: "Password is too short",
    });
  } else {
    User.find({ email })
      .then((result) => {
        if (result.length) {
          res.json({
            status: "FAILED",
            message: "User with the provided email already exists",
          });
        } else {
          const saltRounds = 10;
          bcrypt
            .hash(password, saltRounds)
            .then((hashedPassword) => {
              const newUser = new User({
                name,
                email,
                password: hashedPassword,
                dateOfBirth,
                verified: false,
              });

              newUser
                .save()
                .then((result) => {
                  // res.json({
                  //   status: "SUCCESS",
                  //   message: "Signup successful",
                  //   data: result,
                  // });
                  sendVerificationEmail(result, res);
                })
                .catch((err) => {
                  res.json({
                    status: "FAILED",
                    message: "An error occured while saving user account",
                  });
                });
            })
            .catch((err) => {
              res.json({
                status: "FAILED",
                message: "An error occured while hashing the password",
              });
            });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "FAILED",
          message: "An error occured while checking for existsing user",
        });
      });
  }
});

const sendVerificationEmail = ({ _id, email }, res) => {
  const uniqueString = uuidv4() + _id;

  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "Email verification",
    html:
      `<p>Please click on the following link to verify your email address:</p>` +
      `<p>This link <b>expires in 6 hours</b>.</p>` +
      `<p>Press <a href=${
        "https://login-gwub.onrender.com/" + "user/verify/" + _id + "/" + uniqueString
      }>here</a> to proceed.</p>`,
  };

  const saltRounds = 10;
  bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniqueString) => {
      const newVerification = new UserVerification({
        userId: _id,
        uniqueString: hashedUniqueString,
        createdAt: Date.now(),
        expiresAt: Date.now() + 21600000,
      });

      newVerification
        .save()
        .then(() => {
          transporter
            .sendMail(mailOptions)
            .then(() => {
              res.json({
                status: "PENDING",
                message: "Verification email sent",
              });
            })
            .catch((error) => {
              res.json({
                status: "FAILED",
                message: "verification mail failed",
              });
            });
        })
        .catch((error) => {
          console.log(error);
          res.json({
            status: "FAILED",
            message: "Couldn't save verification email data!",
          });
        });
    })
    .catch(() => {
      res.json({
        status: "FAILED",
        message: "An error occured while hashing email data!",
      });
    });
};

router.get("/verify/:userId/:uniqueString", (req, res) => {
  let { userId, uniqueString } = req.params;

  UserVerification.find({ userId })
    .then((result) => {
      if (result.length > 0) {
        const { expiresAt } = result[0];
        const hashedUniqueString = result[0].uniqueString;
        if (expiresAt < Date.now()) {
          UserVerification.deleteOne({ userId })
            .then((result) => {
              User.deleteOne({ _id: userId })
                .then(() => {
                  let message = "Link has expired. Please signup again";
                  res.redirect(`/user/verified?error=true&message=${message}`);
                })
                .catch((error) => {
                  let message =
                    "Clearing user with expired unique string failed";
                  res.redirect(`/user/verified?error=true&message=${message}`);
                });
            })
            .catch((error) => {
              let message =
                "An error occured while clearing expired user verification record";
              res.redirect(`/user/verified?error=true&message=${message}`);
            });
        } else {
          bcrypt
            .compare(uniqueString, hashedUniqueString)
            .then((result) => {
              if (result) {
                User.updateOne({ _id: userId }, { verified: true })
                  .then(() => {
                    UserVerification.deleteOne({ userId })
                      .then(() => {
                        res.sendFile(
                          path.join(__dirname, "./../views/verified.html")
                        );
                      })
                      .catch((error) => {
                        let message =
                          "An error occured while finalizing successful verification.";
                        res.redirect(
                          `/user/verified?error=true&message=${message}`
                        );
                      });
                  })
                  .catch((error) => {
                    console.log(error);
                    let message =
                      "An error occured while updating user record to show verified.";
                    res.redirect(
                      `/user/verified?error=true&message=${message}`
                    );
                  });
              } else {
                let message =
                  "Invalid verification details passed. Check your inbox.";
                res.redirect(`/user/verified?error=true&message=${message}`);
              }
            })
            .catch((error) => {
              let message = "An error occured while comparing unqiue strings.";
              res.redirect(`/user/verified?error=true&message=${message}`);
            });
        }
      } else {
        let message =
          "Account record doesn't exist or has been verified.Please signup or login.";
        res.redirect(`/user/verified?error=true&message=${message}`);
      }
    })
    .catch((error) => {
      console.log(error);
      let message =
        "An error occured while checking for existing user verification record";
      res.redirect(`/user/verified?error=true&message=${message}`);
    });
});

router.get("/verified", (req, res) => {
  res.sendFile(path.join(__dirname, "./../views/verified.html"));
});

//signin
router.post("/signin", (req, res) => {
  let { email, password } = req.body;

  email = email.trim();
  password = password.trim();

  if (email == "" || password == "") {
    res.json({
      status: "FAILED",
      message: "Empty credentials supplied!",
    });
  } else {
    User.find({ email })
      .then((data) => {
        if (data.length) {
          if (!data[0].verified) {
            res.json({
              status: "FAILED",
              message: "Email hasn't been verified yet.Check your Inbox.",
              data: data,
              token: token,
            });
          } else {
            const hashedPassword = data[0].password;
            bcrypt
              .compare(password, hashedPassword)
              .then((result) => {
                if (result) {
                  const token = jwt.sign({ email }, process.env.SECRET_KEY);
                  console.log(token);
                  res.cookie("isLoggedIn", true);
                  console.log(req.cookies.isLoggedIn);
                  req.session.isLoggedIn = true;
                  // console.log(req.session);
                  // console.log(req.session.isLoggedIn);
                  req.headers["Authorization"] = `Bearer ${token}`;
                  res.json({
                    status: "SUCCESS",
                    message: "Signin Successful",
                    data: data,
                    token: token,
                  });
                } else {
                  res.json({
                    status: "FAILED",
                    message: "Invalid passworrd enetered",
                  });
                }
              })
              .catch((err) => {
                console.log(err);
                res.json({
                  status: "FAILED",
                  message: "An error occured while comparing the password",
                });
              });
          }
        } else {
          res.json({
            status: "FAILED",
            message: "Invalid credentials supplied",
          });
        }
      })
      .catch((err) => {
        res.json({
          status: "FAILED",
          message: "An error occured while checking for existing user",
        });
      });
  }
});

module.exports = router;
