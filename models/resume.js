
module.exports = (mongoose) => {
  const ResumeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    skills: { type: [String], required: true, default: [] },
    experience: { type: String },
    resumeText: { type: String, index: true },
    filePath: { type: String },
    createdAt: { type: Date, required: true, default: Date.now },
  });
  return mongoose.model('resume', ResumeSchema);
};