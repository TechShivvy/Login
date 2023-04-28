const express = require("express");
const router = express.Router();

const User = require("./../models/User");

const bcrypt = require("bcrypt");

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
              });

              newUser
                .save()
                .then((result) => {
                  res.json({
                    status: "SUCCESS",
                    message: "Signup successful",
                    data: result,
                  });
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
    User.find({ email }).then((data) => {
      if (data.length) {
        const hashedPassword = data[0].password;
        bcrypt
          .compare(password, hashedPassword)
          .then((result) => {
            if (result) {
              res.json({
                status: "SUCCESS",
                message: "Signin Successful",
                data: data,
              });
            } else {
              res.json({
                status: "FAILED",
                message: "Invalid passworrd enetered",
              });
            }
          })
          .catch((err) => {
            res.json({
              status: "FAILED",
              message: "An error occured while comparing the password",
            });
          });
      } else {
        res.json({
          status: "FAILED",
          message: "Invalid credentials supplied",
        })
      }
    }).catch(err => {
        res.json({
            status: "FAILED",
            message: "An error occured while checking for existing user",
          })
    })
  }
});

module.exports = router;
