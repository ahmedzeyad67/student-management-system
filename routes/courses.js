const express = require("express");
const router = express.Router();
const Course = require("../models/course");
const Student = require("../models/student");

// Get all courses
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find();
    res.render("courses/index", { courses });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// New course form
router.get("/new", async (req, res) => {
  try {
    const availableCourses = await Course.find().select("courseCode title");
    res.render("courses/new", {
      course: {},
      availableCourses,
      error: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Create course
router.post("/", async (req, res) => {
  try {
    req.body.isActive = req.body.isActive === "on";
    const course = new Course(req.body);
    await course.save();
    res.redirect("/courses");
  } catch (err) {
    console.error(err);
    const availableCourses = await Course.find().select("courseCode title");
    res.status(400).render("courses/new", {
      error: err.message,
      course: req.body,
      availableCourses,
    });
  }
});

// Show course details
router.get("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.redirect("/courses?error=Course+not+found");
    }

    const students = await Student.find(
      { "courses._id": req.params.id },
      "studentId firstName lastName email courses.$"
    );

    const enrolledStudents = students.map((student) => ({
      ...student.toObject(),
      grade: student.courses[0].grade,
      semester: student.courses[0].semester,
    }));

    res.render("courses/show", {
      course,
      enrolledStudents,
      error: req.query.error,
      success: req.query.success,
    });
  } catch (err) {
    res.redirect(`/courses?error=${encodeURIComponent(err.message)}`);
  }
});

// Edit course form
router.get("/:id/edit", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    const allCourses = await Course.find();
    res.render("courses/edit", { course, allCourses, error: null });
  } catch (err) {
    console.error(err);
    res.redirect("/courses");
  }
});

// Update course
router.put("/:id", async (req, res) => {
  try {
    const courseId = req.params.id;
    const newCreditHours = Number(req.body.creditHours);

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { creditHours: newCreditHours },
      { new: true, runValidators: true }
    );

    if (!updatedCourse) {
      return res.status(404).redirect("/courses?error=Course+not+found");
    }

    await Student.updateMany(
      { "courses._id": courseId },
      { $set: { "courses.$.creditHours": newCreditHours } }
    );

    res.redirect(`/courses/${courseId}?success=Course+and+enrollments+updated`);
  } catch (err) {
    console.error("Update error:", err);
    const errorMessage =
      err.name === "ValidationError"
        ? Object.values(err.errors)
            .map((e) => e.message)
            .join(", ")
        : "Update failed";
    res.redirect(
      `/courses/${req.params.id}/edit?error=${encodeURIComponent(errorMessage)}`
    );
  }
});

// Delete course
router.delete("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    await course.deleteOne();

    res.redirect("/courses?success=Course+deleted+successfully");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
