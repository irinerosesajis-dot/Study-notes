const fs = require("fs");
const path = require("path");
const QuestionBank = require("../models/QuestionBank");
const { supabase } = require("../config/supabase");

// @desc    Upload a question bank (and optional solution)
// @route   POST /api/question-banks/upload
// @access  Private
const uploadQuestionBank = async (req, res) => {
  try {
    const { title, subject, scheme, semester, branch, year } = req.body;

    if (!title || !scheme || !semester || !branch || !year) {
      return res.status(400).json({
        message: "Title, Scheme, Semester, Branch, and Year are required fields.",
      });
    }

    const questionFile = req.files && req.files["questionFile"] ? req.files["questionFile"][0] : null;
    const solutionFile = req.files && req.files["solutionFile"] ? req.files["solutionFile"][0] : null;

    if (!questionFile) {
      return res.status(400).json({ message: "Question paper file is required." });
    }

    let questionUrl = "";
    let isQLocal = false;

    if (supabase) {
      try {
        // Upload Question Paper to Supabase Storage
        const qUniqueName = `questions/${Date.now()}-${questionFile.originalname.replace(/\s+/g, "_")}`;
        const { data, error } = await supabase.storage
          .from("question-banks")
          .upload(qUniqueName, questionFile.buffer, {
            contentType: questionFile.mimetype,
            upsert: false,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("question-banks")
          .getPublicUrl(qUniqueName);
        questionUrl = urlData.publicUrl;
      } catch (err) {
        console.warn("Supabase Storage upload for question file failed, falling back to local disk storage:", err.message);
        isQLocal = true;
      }
    } else {
      console.warn("Supabase Storage is not configured, falling back to local disk storage for question file.");
      isQLocal = true;
    }

    if (isQLocal) {
      const uploadDir = path.join(__dirname, "..", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFileName = `${Date.now()}-q-${questionFile.originalname.replace(/\s+/g, "_")}`;
      const localFilePath = path.join(uploadDir, localFileName);
      fs.writeFileSync(localFilePath, questionFile.buffer);
      questionUrl = `uploads/${localFileName}`;
    }

    const questionBankData = {
      title,
      subject: subject || "",
      scheme,
      semester,
      branch,
      year: parseInt(year),
      questionFileName: questionFile.originalname,
      questionFilePath: questionUrl,
      questionFileType: questionFile.mimetype,
      questionFileSize: questionFile.size,
      uploadedBy: req.user.id,
    };

    if (solutionFile) {
      let solutionUrl = "";
      let isSLocal = false;

      if (supabase) {
        try {
          // Upload Solution to Supabase Storage
          const sUniqueName = `solutions/${Date.now()}-${solutionFile.originalname.replace(/\s+/g, "_")}`;
          const { data, error } = await supabase.storage
            .from("question-banks")
            .upload(sUniqueName, solutionFile.buffer, {
              contentType: solutionFile.mimetype,
              upsert: false,
            });

          if (error) throw error;

          const { data: urlData } = supabase.storage
            .from("question-banks")
            .getPublicUrl(sUniqueName);
          solutionUrl = urlData.publicUrl;
        } catch (err) {
          console.warn("Supabase Storage upload for solution file failed, falling back to local disk storage:", err.message);
          isSLocal = true;
        }
      } else {
        isSLocal = true;
      }

      if (isSLocal) {
        const uploadDir = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const localFileName = `${Date.now()}-s-${solutionFile.originalname.replace(/\s+/g, "_")}`;
        const localFilePath = path.join(uploadDir, localFileName);
        fs.writeFileSync(localFilePath, solutionFile.buffer);
        solutionUrl = `uploads/${localFileName}`;
      }

      questionBankData.solutionFileName = solutionFile.originalname;
      questionBankData.solutionFilePath = solutionUrl;
      questionBankData.solutionFileType = solutionFile.mimetype;
      questionBankData.solutionFileSize = solutionFile.size;
    }

    const questionBank = await QuestionBank.create(questionBankData);

    res.status(201).json({
      message: "Question bank uploaded successfully",
      questionBank,
    });
  } catch (error) {
    console.error("Question bank upload error:", error.message);
    if (error.customData && error.customData.serverResponse) {
      console.error("Firebase response details:", error.customData.serverResponse);
    }
    res.status(500).json({ message: "Server error during upload" });
  }
};

// @desc    Get all question banks (with filtering)
// @route   GET /api/question-banks
// @access  Private
const getAllQuestionBanks = async (req, res) => {
  try {
    const { scheme, semester, branch, searchQuery } = req.query;
    let query = {};

    if (scheme) query.scheme = scheme;
    if (semester) query.semester = semester;
    if (branch) query.branch = branch;

    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.trim();
      query.$or = [
        { title: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
        { branch: { $regex: q, $options: "i" } }
      ];
    }

    const questionBanks = await QuestionBank.find(query)
      .populate("uploadedBy", "name email")
      .sort({ year: -1, createdAt: -1 });

    res.status(200).json({ count: questionBanks.length, questionBanks });
  } catch (error) {
    console.error("Get question banks error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Download a file from question bank (question paper or solution)
// @route   GET /api/question-banks/:id/download
// @access  Private
const downloadQuestionBankFile = async (req, res) => {
  try {
    const { type } = req.query; // 'question' or 'solution'
    const questionBank = await QuestionBank.findById(req.params.id);

    if (!questionBank) {
      return res.status(404).json({ message: "Question bank not found" });
    }

    let filePath = "";
    let fileName = "";

    if (type === "solution") {
      if (!questionBank.solutionFilePath) {
        return res.status(404).json({ message: "Solution file not found for this question bank" });
      }
      filePath = questionBank.solutionFilePath;
      fileName = questionBank.solutionFileName;
    } else {
      filePath = questionBank.questionFilePath;
      fileName = questionBank.questionFileName;
    }

    if (filePath && filePath.startsWith("http")) {
      return res.redirect(filePath);
    }

    const absolutePath = path.join(__dirname, "..", filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.download(absolutePath, fileName);
  } catch (error) {
    console.error("Question bank download error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete a question bank (only by the uploader)
// @route   DELETE /api/question-banks/:id
// @access  Private
const deleteQuestionBank = async (req, res) => {
  try {
    const questionBank = await QuestionBank.findById(req.params.id);

    if (!questionBank) {
      return res.status(404).json({ message: "Question bank not found" });
    }

    // Ensure only the uploader can delete
    if (questionBank.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this question bank" });
    }

    // Remove files
    if (questionBank.questionFilePath) {
      if (questionBank.questionFilePath.startsWith("http")) {
        if (supabase) {
          try {
            const urlParts = questionBank.questionFilePath.split("/object/public/question-banks/");
            if (urlParts.length > 1) {
              const fileName = urlParts[1];
              const { error } = await supabase.storage.from("question-banks").remove([fileName]);
              if (error) throw error;
            }
          } catch (err) {
            console.error("Error deleting question paper from Supabase:", err.message);
          }
        } else {
          console.warn("Supabase Storage is not configured. Skipping cloud file deletion.");
        }
      } else {
        const qPath = path.join(__dirname, "..", questionBank.questionFilePath);
        if (fs.existsSync(qPath)) fs.unlinkSync(qPath);
      }
    }
    if (questionBank.solutionFilePath) {
      if (questionBank.solutionFilePath.startsWith("http")) {
        if (supabase) {
          try {
            const urlParts = questionBank.solutionFilePath.split("/object/public/question-banks/");
            if (urlParts.length > 1) {
              const fileName = urlParts[1];
              const { error } = await supabase.storage.from("question-banks").remove([fileName]);
              if (error) throw error;
            }
          } catch (err) {
            console.error("Error deleting solution from Supabase:", err.message);
          }
        } else {
          console.warn("Supabase Storage is not configured. Skipping cloud file deletion.");
        }
      } else {
        const sPath = path.join(__dirname, "..", questionBank.solutionFilePath);
        if (fs.existsSync(sPath)) fs.unlinkSync(sPath);
      }
    }

    await questionBank.deleteOne();

    res.status(200).json({ message: "Question bank deleted successfully" });
  } catch (error) {
    console.error("Delete question bank error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Add a solution file to an existing question bank
// @route   PUT /api/question-banks/:id/solution
// @access  Private
const addSolution = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Solution file is required." });
    }

    const questionBank = await QuestionBank.findById(req.params.id);

    if (!questionBank) {
      return res.status(404).json({ message: "Question bank not found" });
    }

    if (questionBank.solutionFilePath) {
      return res.status(400).json({ message: "A solution file has already been uploaded for this question bank." });
    }

    let solutionUrl = "";
    let isSLocal = false;

    if (supabase) {
      try {
        // Upload Solution to Supabase Storage
        const sUniqueName = `solutions/${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
        const { data, error } = await supabase.storage
          .from("question-banks")
          .upload(sUniqueName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("question-banks")
          .getPublicUrl(sUniqueName);
        solutionUrl = urlData.publicUrl;
      } catch (err) {
        console.warn("Supabase Storage upload for solution file failed, falling back to local disk storage:", err.message);
        isSLocal = true;
      }
    } else {
      isSLocal = true;
    }

    if (isSLocal) {
      const uploadDir = path.join(__dirname, "..", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFileName = `${Date.now()}-s-${req.file.originalname.replace(/\s+/g, "_")}`;
      const localFilePath = path.join(uploadDir, localFileName);
      fs.writeFileSync(localFilePath, req.file.buffer);
      solutionUrl = `uploads/${localFileName}`;
    }

    // Attach solution file
    questionBank.solutionFileName = req.file.originalname;
    questionBank.solutionFilePath = solutionUrl;
    questionBank.solutionFileType = req.file.mimetype;
    questionBank.solutionFileSize = req.file.size;

    await questionBank.save();

    res.status(200).json({
      message: "Solution uploaded and attached successfully",
      questionBank,
    });
  } catch (error) {
    console.error("Add solution error:", error.message);
    if (error.customData && error.customData.serverResponse) {
      console.error("Firebase response details:", error.customData.serverResponse);
    }
    res.status(500).json({ message: "Server error during solution upload" });
  }
};

// @desc    Get question banks uploaded by the logged-in user
// @route   GET /api/question-banks/my
// @access  Private
const getMyQuestionBanks = async (req, res) => {
  try {
    const questionBanks = await QuestionBank.find({ uploadedBy: req.user.id })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ count: questionBanks.length, questionBanks });
  } catch (error) {
    console.error("Get my question banks error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  uploadQuestionBank,
  getAllQuestionBanks,
  downloadQuestionBankFile,
  deleteQuestionBank,
  addSolution,
  getMyQuestionBanks,
};
