const fs = require("fs");
const path = require("path");
const QuestionBank = require("../models/QuestionBank");
const { storage } = require("../config/firebase");
const { ref, uploadBytesResumable, getDownloadURL, deleteObject } = require("firebase/storage");

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

    if (!storage) {
      return res.status(500).json({ message: "Firebase Storage is not configured on the server. Please define Firebase environment variables in your .env file." });
    }

    // Upload Question Paper to Firebase Storage
    const qUniqueName = `question-banks/questions/${Date.now()}-${questionFile.originalname.replace(/\s+/g, "_")}`;
    const qStorageRef = ref(storage, qUniqueName);
    const qMetadata = { contentType: questionFile.mimetype };
    const qSnapshot = await uploadBytesResumable(qStorageRef, questionFile.buffer, qMetadata);
    const questionUrl = await getDownloadURL(qSnapshot.ref);

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
      // Upload Solution to Firebase Storage
      const sUniqueName = `question-banks/solutions/${Date.now()}-${solutionFile.originalname.replace(/\s+/g, "_")}`;
      const sStorageRef = ref(storage, sUniqueName);
      const sMetadata = { contentType: solutionFile.mimetype };
      const sSnapshot = await uploadBytesResumable(sStorageRef, solutionFile.buffer, sMetadata);
      const solutionUrl = await getDownloadURL(sSnapshot.ref);

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

    const absolutePath = path.resolve(filePath);

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
        if (storage) {
          try {
            const fileRef = ref(storage, questionBank.questionFilePath);
            await deleteObject(fileRef);
          } catch (err) {
            console.error("Error deleting question paper from Firebase:", err.message);
          }
        } else {
          console.warn("Firebase Storage is not configured. Skipping cloud file deletion.");
        }
      } else {
        const qPath = path.resolve(questionBank.questionFilePath);
        if (fs.existsSync(qPath)) fs.unlinkSync(qPath);
      }
    }
    if (questionBank.solutionFilePath) {
      if (questionBank.solutionFilePath.startsWith("http")) {
        if (storage) {
          try {
            const fileRef = ref(storage, questionBank.solutionFilePath);
            await deleteObject(fileRef);
          } catch (err) {
            console.error("Error deleting solution from Firebase:", err.message);
          }
        } else {
          console.warn("Firebase Storage is not configured. Skipping cloud file deletion.");
        }
      } else {
        const sPath = path.resolve(questionBank.solutionFilePath);
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

    if (!storage) {
      return res.status(500).json({ message: "Firebase Storage is not configured on the server. Please define Firebase environment variables in your .env file." });
    }

    // Upload Solution to Firebase Storage
    const sUniqueName = `question-banks/solutions/${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
    const sStorageRef = ref(storage, sUniqueName);
    const sMetadata = { contentType: req.file.mimetype };
    const sSnapshot = await uploadBytesResumable(sStorageRef, req.file.buffer, sMetadata);
    const solutionUrl = await getDownloadURL(sSnapshot.ref);

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
