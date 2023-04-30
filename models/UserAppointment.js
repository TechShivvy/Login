const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const userAppointmentSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    appointmentId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
      }
    ]
  });

  const UserAppointment = mongoose.model('UserAppointment', userAppointmentSchema);
  module.exports = UserAppointment;