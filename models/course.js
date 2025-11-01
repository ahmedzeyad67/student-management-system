const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  creditHours: {
    type: Number,
    required: true,
    min: 1,
    max: 6,
  },
  department: String,
  prerequisites: [String],
  isActive: {
    type: Boolean,
    default: true,
  },
  schedule: {
    days: [String],
    time: String,
    room: String,
  },
});

courseSchema.pre("deleteOne", { document: true }, async function (next) {
  try {
    const courseId = this._id;

    await mongoose
      .model("Student")
      .updateMany(
        { "courses._id": courseId },
        { $pull: { courses: { _id: courseId } } }
      );
    next();
  } catch (err) {
    next(err);
  }
});

// Indexes
courseSchema.index({ courseCode: 1 }, { unique: true });
courseSchema.index({ department: 1, creditHours: 1 });

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
