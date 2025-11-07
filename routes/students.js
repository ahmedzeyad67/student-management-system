const express = require("express");
const router = express.Router();
const Student = require("../models/student");
const Course = require("../models/course");
const mongoose = require("mongoose");

// Function to process form data
const processFormData = (body) => ({
  ...body,
  isActive: body.isActive === "on",
  enrollmentDate: body.enrollmentDate
    ? new Date(body.enrollmentDate)
    : new Date(),
  address: {
    street: body.address?.street || body["address[street]"] || "",
    city: body.address?.city || body["address[city]"] || "",
  },
});

// Get all students
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().sort({ studentId: 1 });
    res.render("students/index", {
      students,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    res.render("students/index", {
      students: [],
      error: "Failed to load students",
    });
  }
});

// New student form
router.get("/new", (req, res) => {
  res.render("students/new", {
    student: {
      firstName: "",
      lastName: "",
      email: "",
      department: "",
      enrollmentDate: new Date().toISOString().split("T")[0],
      isActive: true,
      address: {
        street: "",
        city: "",
      },
    },
    error: null,
  });
});

// Create student
router.post("/", async (req, res) => {
  try {
    const student = new Student(processFormData(req.body));
    await student.save();
    res.redirect(
      `/students/${student.studentId}?success=Student+created+successfully`
    );
  } catch (err) {
    res.render("students/new", {
      student: {
        ...req.body,
        enrollmentDate: req.body.enrollmentDate,
        address: {
          street: req.body.address?.street || "",
          city: req.body.address?.city || "",
        },
      },
      error: err.message,
    });
  }
});

// Search
router.get("/search", async (req, res) => {
  try {
    const { name, department, minGpa, status, minCourses } = req.query;
    const query = {};

    if (name) {
      query.$or = [
        { firstName: { $regex: name, $options: "i" } },
        { lastName: { $regex: name, $options: "i" } },
      ];
    }

    if (department) query.department = department;

    if (minGpa) {
      const num = parseFloat(minGpa);
      if (!isNaN(num)) {
        query.GPA = { $gte: num };
      } else {
        return res.redirect("/students/search?error=Invalid+GPA+value");
      }
    }

    if (status) query.isActive = status === "active";

    if (minCourses) {
      const numCourses = parseInt(minCourses);
      if (!isNaN(numCourses)) {
        query.$expr = { $gte: [{ $size: "$courses" }, numCourses] };
      } else {
        return res.redirect("/students/search?error=Invalid+course+count");
      }
    }

    const students = await Student.find(query).sort({
      lastName: 1,
      firstName: 1,
    });

    res.render("students/search", {
      students,
      departments: await Student.distinct("department"),
      query: req.query,
    });
  } catch (err) {
    console.error("Search error:", err);
    res.redirect("/students/search?error=Search+failed");
  }
});

// Show student details
router.get("/:studentId", async (req, res) => {
  try {
    const student = await Student.findOne({
      studentId: req.params.studentId,
    }).populate({
      path: "courses._id",
      model: "Course",
      options: { allowNull: true },
    });

    if (!student) {
      return res.redirect("/students?error=Student+not+found");
    }

    const validCourses = student.courses.filter(
      (course) => course._id !== null
    );

    const courses = await Course.find({
      _id: { $nin: validCourses.map((c) => c._id) },
    });

    res.render("students/show", {
      student: {
        ...student.toObject(),
        courses: validCourses,
        address: student.address || { street: "", city: "" },
      },
      courses,
      success: req.query.success,
      enrollError: req.query.enrollError || null,
      error: req.query.error,
    });
  } catch (err) {
    console.error("Error in student show route:", err);
    res.redirect(`/students?error=${encodeURIComponent(err.message)}`);
  }
});

// Edit student form
router.get("/:studentId/edit", async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });
    if (!student) {
      return res.redirect("/students?error=Student+not+found");
    }

    let enrollmentDate;
    if (student.enrollmentDate instanceof Date) {
      enrollmentDate = student.enrollmentDate.toISOString().split("T")[0];
    } else if (typeof student.enrollmentDate === "string") {
      enrollmentDate = new Date(student.enrollmentDate)
        .toISOString()
        .split("T")[0];
    } else {
      enrollmentDate = new Date().toISOString().split("T")[0];
    }

    res.render("students/edit", {
      student: {
        ...student.toObject(),
        enrollmentDate: enrollmentDate,
        address: student.address || { street: "", city: "" },
      },
      error: req.query.error || null,
    });
  } catch (err) {
    res.redirect(`/students?error=${encodeURIComponent(err.message)}`);
  }
});

// Update student
router.put("/:studentId", async (req, res) => {
  try {
    const existingStudent = await Student.findOne({
      studentId: Number(req.params.studentId),
    });

    if (!existingStudent) {
      throw new Error("Student not found");
    }

    const updateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      department: req.body.department,
      email: req.body.email,
      isActive: req.body.isActive === "on",
      enrollmentDate: new Date(req.body.enrollmentDate || Date.now()),
      address: {
        street: req.body.address?.street || "",
        city: req.body.address?.city || "",
      },
      studentId: existingStudent.studentId,
    };

    // 3. Perform the update
    const updatedStudent = await Student.findOneAndUpdate(
      { studentId: existingStudent.studentId },
      updateData,
      { new: true }
    );

    // 4. Redirect on success
    res.redirect(
      `/students/${updatedStudent.studentId}?success=Student updated successfully`
    );
  } catch (err) {
    // 5. On error, re-render with existing data
    res.render("students/edit", {
      student: {
        ...req.body,
        studentId: req.params.studentId, // Preserve original ID
        isActive: req.body.isActive === "on",
      },
      error: err.message,
    });
  }
});

// Enroll in course
router.post("/:studentId/courses", async (req, res) => {
  try {
    // Find student and populate courses
    const student = await Student.findOne({
      studentId: req.params.studentId,
    }).populate("courses._id");

    // Find the course to enroll in
    const course = await Course.findById(req.body.courseId);

    if (!student || !course) {
      const courses = await Course.find({
        _id: { $nin: student?.courses?.map((c) => c._id) || [] },
      });
      return res.render("students/show", {
        student,
        courses,
        enrollError: "Invalid student or course selected.",
        error: req.query.error,
        success: null,
      });
    }

    // Check if already enrolled in this course for the semester
    const alreadyEnrolled = student.courses.some(
      (c) => c._id.equals(course._id) && c.semester === req.body.semester
    );

    if (alreadyEnrolled) {
      const courses = await Course.find({
        _id: { $nin: student.courses.map((c) => c._id) },
      });
      return res.render("students/show", {
        student,
        courses,
        enrollError:
          "Already enrolled in this course for the selected semester.",
        error: req.query.error,
        success: null,
      });
    }

    // Add new course with credit hours
    student.courses.push({
      _id: course._id,
      semester: req.body.semester,
      creditHours: course.creditHours, // Include credit hours from course
    });

    // Save and get fully populated student data
    await student.save();
    const updatedStudent = await Student.findOne({
      studentId: req.params.studentId,
    }).populate("courses._id");

    // Get updated list of available courses
    const updatedCourses = await Course.find({
      _id: { $nin: updatedStudent.courses.map((c) => c._id) },
    });

    // Calculate GPA after enrollment
    updatedStudent.calculateGPA();
    await updatedStudent.save();

    // Render the view with updated data
    res.render("students/show", {
      student: {
        ...updatedStudent.toObject(),
        address: updatedStudent.address || { street: "", city: "" },
      },
      courses: updatedCourses,
      success: "Successfully enrolled in course!",
      enrollError: null,
      error: req.query.error,
    });
  } catch (err) {
    console.error("Enrollment error:", err);
    try {
      const student = await Student.findOne({
        studentId: req.params.studentId,
      }).populate("courses._id");

      const courses = await Course.find({
        _id: { $nin: student?.courses?.map((c) => c._id) || [] },
      });

      res.render("students/show", {
        student,
        courses,
        enrollError: "An error occurred while enrolling in the course.",
        error: req.query.error,
        success: null,
      });
    } catch (innerErr) {
      res.redirect(`/students?error=${encodeURIComponent(innerErr.message)}`);
    }
  }
});

// Drop Course Route
router.post("/:studentId/courses/:id/remove", async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });

    if (!student) {
      return res.redirect("/students?error=Student+not+found");
    }

    const courseObjectId = new mongoose.Types.ObjectId(req.params.id);

    // Remove the course
    student.courses = student.courses.filter(
      (course) => !course._id.equals(courseObjectId)
    );

    // Recalculate GPA
    student.calculateGPA();
    await student.save();

    // Get updated student with populated courses
    const updatedStudent = await Student.findOne({
      studentId: req.params.studentId,
    }).populate("courses._id");

    // Get available courses
    const availableCourses = await Course.find({
      _id: { $nin: updatedStudent.courses.map((c) => c._id) },
    });

    res.render("students/show", {
      student: {
        ...updatedStudent.toObject(),
        address: updatedStudent.address || { street: "", city: "" },
      },
      courses: availableCourses,
      success: "Course dropped successfully",
      enrollError: null,
      error: null,
    });
  } catch (err) {
    res.redirect(
      `/students/${req.params.studentId}?error=${encodeURIComponent(
        err.message
      )}`
    );
  }
});

// Add/Edit Grade Route (GET - show form)
router.get("/:studentId/courses/:id/edit-grade", async (req, res) => {
  try {
    const student = await Student.findOne({
      studentId: req.params.studentId,
    }).populate("courses._id");

    if (!student) {
      return res.redirect("/students?error=Student+not+found");
    }

    // Fix 3: Use params.id and convert to ObjectId
    const courseObjectId = new mongoose.Types.ObjectId(req.params.id);
    const course = student.courses.find((c) => c._id.equals(courseObjectId));

    if (!course) {
      return res.redirect(
        `/students/${student.studentId}?error=Course+not+found`
      );
    }

    res.render("students/edit-grade", {
      student,
      course,
      error: req.query.error,
    });
  } catch (err) {
    res.redirect(`/students?error=${encodeURIComponent(err.message)}`);
  }
});

// Update Grade Route (POST - process form)
router.post("/:studentId/courses/:id/update-grade", async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });

    if (!student) {
      return res.redirect("/students?error=Student+not+found");
    }

    const courseObjectId = new mongoose.Types.ObjectId(req.params.id);
    const courseIndex = student.courses.findIndex((c) =>
      c._id.equals(courseObjectId)
    );

    if (courseIndex === -1) {
      return res.redirect(
        `/students/${student.studentId}?error=Course+not+found`
      );
    }

    // Handle grade input (including 0)
    const grade = parseFloat(req.body.grade);
    student.courses[courseIndex].grade = isNaN(grade) ? null : grade;

    // Recalculate GPA with precise calculation
    student.calculateGPA();
    await student.save();

    // Get updated student with populated courses
    const updatedStudent = await Student.findOne({
      studentId: student.studentId,
    }).populate("courses._id");

    res.render("students/show", {
      student: {
        ...updatedStudent.toObject(),
        address: updatedStudent.address || { street: "", city: "" },
      },
      courses: await Course.find({
        _id: { $nin: updatedStudent.courses.map((c) => c._id) },
      }),
      success: "Grade updated successfully",
      enrollError: null,
      error: null,
    });
  } catch (err) {
    res.redirect(
      `/students/${req.params.studentId}/courses/${
        req.params.id
      }/edit-grade?error=${encodeURIComponent(err.message)}`
    );
  }
});

// Delete student
router.delete("/:studentId", async (req, res) => {
  try {
    await Student.findOneAndDelete({ studentId: req.params.studentId });
    res.redirect("/students?success=Student+deleted+successfully");
  } catch (err) {
    res.redirect(
      `/students/${req.params.studentId}?error=${encodeURIComponent(
        "Delete+failed"
      )}`
    );
  }
});

module.exports = router;
