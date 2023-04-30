const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: String,
  email: String,
  password: String,
  dateOfBirth: Date,
  verified: Boolean,
  offHours: {
    type: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true
        },
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          required: true,
        },
        start: {
          type: Date,
          required: true,
        },
        end: {
          type: Date,
          required: true,
        }
      }
    ],
    default: []
  }
});

const User=mongoose.model('User',UserSchema);

module.exports = User;