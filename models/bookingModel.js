const mongoose = require('mongoose');

const bookingSchema = mongoose.Schema(
  {
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Booking must belong to a tour']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Booking must belong to a user']
    },
    price: {
      type: Number,
      required: [true, 'Booking must have a price']
    },
    paid: {
      type: Boolean,
      default: true
    }
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);
bookingSchema.pre(/^find/, function(next) {
  this.populate('user').populate('tour');
  next();
});
bookingSchema.virtual('tours', {
  ref: 'Tour',
  foreignField: '_id',
  localField: 'tour'
});
const booking = mongoose.model('booking', bookingSchema);
module.exports = booking;