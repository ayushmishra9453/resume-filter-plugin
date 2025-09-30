
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const skillKeywords = [
  'Javascript', 'React', 'Node.js', 'MongoDB', 'Express.js', 'python', 'Django', 'Java', 'Spring',
  'C', 'C++', 'HTML', 'CSS', 'Tailwind CSS', 'Bootstrap', 'Next.js', 'Automation', 'AWS', 'Azure',
  'Google Cloud', 'Manual Testing', 'Jmeter', 'LoadRunner', 'Jira'
];

function escapeRegex(text) {
  return text.replace(/[-[\${}()*+?.,\\^$|#\s]/g, '\\$&');
}

function countOccurrences(text, keyword) {
  if (!text || !keyword) return 0;
  const r = new RegExp(escapeRegex(keyword), 'gi');
  const matches = text.match(r);
  return matches ? matches.length : 0;
}

function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
  return match ? match[0] : "";
}

function extractName(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    return lines[0].replace(/[^a-zA-Z ]/g, "").trim();
  }
  return "";
}

function extractSkills(text) {
  const found = [];
  for (const skill of skillKeywords) {
    const safeSkill = escapeRegex(skill);
    const regex = new RegExp("\\b" + safeSkill + "\\b", "i");
    if (regex.test(text)) {
      found.push(skill);
    }
  }
  return found;
}

const extractText = async (filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".pdf") {
      const data = fs.readFileSync(filePath);
      const parsed = await pdfParse(data);
      return parsed.text || "";
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || "";
    } else if (ext === ".txt") {
      return fs.readFileSync(filePath, "utf8");
    } else {
      throw new Error("Unsupported file type: " + ext);
    }
  } catch (err) {
    console.error("Failed to extract text from:", filePath, "Error:", err.message);
    return "";
  }
};

module.exports = (Resume) => {
  return {
    uploadResume: async (req, res) => {
      try {
        const { file } = req;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        const { name, email, skills = "", experience = "" } = req.body;
        const skillsArr = skills.split(",").map((s) => s.trim()).filter(Boolean);

        const resumeText = await extractText(file.path);

        const doc = new Resume({
          name,
          email,
          skills: skillsArr,
          experience,
          resumeText,
          filePath: file.path,
        });

        await doc.save();
        res.json({ success: true, id: doc._id });
      } catch (err) {
        console.error("uploadResume error:", err);
        res.status(500).json({ error: err.message || "Upload failed" });
      }
    },

    searchResumes: async (req, res) => {
      try {
        const q = req.query.q || "";
        if (!q.trim()) return res.json({ results: [] });

        const keywords = q.split(/,|\s+/).map((s) => s.trim()).filter(Boolean);
        if (keywords.length === 0) return res.json({ results: [] });

        const orQueries = [];
        for (const kw of keywords) {
          const r = new RegExp(escapeRegex(kw), "i");
          orQueries.push({ resumeText: { $regex: r } });
          orQueries.push({ skills: { $in: [r] } });
          orQueries.push({ experience: { $regex: r } });
          orQueries.push({ name: { $regex: r } });
        }

        const candidates = await Resume.find({ $or: orQueries }).limit(200).lean();

        const results = candidates.map((doc) => {
          const hay =
            (doc.resumeText || "") +
            " " +
            (doc.skills || []).join(" ") +
            " " +
            (doc.experience || "") +
            " " +
            (doc.name || "");
          let score = 0;
          for (const kw of keywords) score += countOccurrences(hay, kw);

          let snippet = "";
          const text = doc.resumeText || "";
          let firstPos = -1;
          for (const kw of keywords) {
            const pos = text.toLowerCase().indexOf(kw.toLowerCase());
            if (pos >= 0 && (firstPos === -1 || pos < firstPos)) firstPos = pos;
          }
          if (firstPos >= 0) {
            const start = Math.max(0, firstPos - 80);
            snippet = text.substring(start, Math.min(text.length, firstPos + 120));
          } else {
            snippet = (text || "").substring(0, 200);
          }

          return {
            id: doc._id,
            name: doc.name,
            email: doc.email,
            skills: doc.skills,
            experience: doc.experience,
            filePath: doc.filePath,
            score,
            snippet,
          };
        });

        results.sort((a, b) => b.score - a.score);

        res.json({ results });
      } catch (err) {
        console.error("searchResumes error:", err);
        res.status(500).json({ error: err.message || "Search failed" });
      }
    },

    uploadMultipleResume: async (req, res) => {
      try {
        const files = req.files;
        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        let savedDocs = [];
        let failedFiles = [];

        for (const file of files) {
          const resumeText = await extractText(file.path);

          if (!resumeText) {
            console.warn("⚠️ Skipping file:", file.originalname);
            failedFiles.push(file.originalname);
            continue;
          }

          const name = extractName(resumeText);
          const email = extractEmail(resumeText);
          const skills = extractSkills(resumeText);

          const doc = new Resume({
            name,
            email,
            skills,
            experience: "",
            resumeText,
            filePath: file.path,
          });

          await doc.save();
          savedDocs.push(doc);
        }

        res.json({
          success: true,
          savedCount: savedDocs.length,
          failedCount: failedFiles.length,
          failedFiles,
          resumes: savedDocs,
        });
      } catch (err) {
        console.error("uploadMultipleResume error:", err);
        res.status(500).json({ error: err.message || "Upload multiple failed" });
      }
    }
  };
};