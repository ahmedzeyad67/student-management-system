const mongoose = require("mongoose");
const Counter = require("./Counter");

const studentSchema = new mongoose.Schema({
  studentId: { type: Number, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  enrollmentDate: {
    type: Date,
    default: Date.now,
    validate: {
      validator: (v) => v instanceof Date && !isNaN(v),
      message: "Invalid enrollment date",
    },
  },
  isActive: { type: Boolean, default: true },
  address: {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
  },
  courses: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
      grade: Number,
      semester: String,
      creditHours: Number,
    },
  ],
  GPA: { type: Number, default: 0 },
});

studentSchema.methods.calculateGPA = function () {
  let totalPoints = 0;
  let totalCreditHours = 0;
  let hasGradedCourses = false;

  this.courses.forEach((course) => {
    if (typeof course.grade === "number" && !isNaN(course.grade)) {
      const points = this.convertGradeToPoints(course.grade);
      totalPoints += points * course.creditHours;
      totalCreditHours += course.creditHours;
      hasGradedCourses = true;
    }
  });

  this.GPA = hasGradedCourses ? totalPoints / totalCreditHours : 0;
  return this.GPA;
};

studentSchema.methods.convertGradeToPoints = function (grade) {
  if (grade >= 97) return 4.0;
  if (grade >= 93) return 3.9;
  if (grade >= 90) return 3.7;
  if (grade >= 87) return 3.3;
  if (grade >= 83) return 3.0;
  if (grade >= 80) return 2.7;
  if (grade >= 77) return 2.3;
  if (grade >= 73) return 2.0;
  if (grade >= 70) return 1.7;
  if (grade >= 67) return 1.3;
  if (grade >= 63) return 1.0;
  if (grade >= 60) return 0.7;
  return 0.0;
};

studentSchema.pre("save", async function (next) {
  if (!this.isNew || this.studentId) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { name: "studentId" },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );
    this.studentId = counter.value;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Student", studentSchema);
