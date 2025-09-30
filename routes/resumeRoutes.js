const express = require("express");
const multer = require("multer");
const path = require('path');
const fs = require('fs');
module.exports = (Resume, resumeController) => {
  const router = express.Router();
  // Setup multer storage
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
  });
  const upload = multer({ storage });
  // Define routes
  router.post("/upload", upload.single("file"), resumeController.uploadResume);
  router.get("/search", resumeController.searchResumes);
  router.post("/uploadMultipleResume", upload.array("files", 20), resumeController.uploadMultipleResume);
  return router;
};