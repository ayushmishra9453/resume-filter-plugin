const express = require('express');
module.exports = (mongooseInstance) => {
  const resumeModel = require('./models/resume')(mongooseInstance);
  // Pass resumeModel to controller functions or require controller as a function that accepts model
  const resumeController = require('./controllers/resumeController')(resumeModel);
  const router = require('express').Router();
  // Setup routes with controller functions
  router.post("/upload", upload.single("file"), resumeController.uploadResume);
  router.get("/search", resumeController.searchResumes);
  router.post("/uploadMultipleResume", upload.array("files", 20), resumeController.uploadMultipleResume);
  return router;
};
