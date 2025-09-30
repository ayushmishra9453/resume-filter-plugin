const express = require('express');
const path = require('path');
module.exports = (mongooseInstance) => {
  const Resume = require('./models/resume')(mongooseInstance);
  const resumeController = require('./controllers/resumeController')(Resume);
  const resumeRoutes = require('./routes/resumeRoutes')(Resume, resumeController);
  return resumeRoutes;
};