const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/authMiddleware");
const {
  uploadQuestionBank,
  getAllQuestionBanks,
  downloadQuestionBankFile,
  deleteQuestionBank,
  addSolution,
  getMyQuestionBanks,
} = require("../controllers/questionBankController");

// ── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.memoryStorage();


const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/gif",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Dual file fields upload setup
const uploadFields = upload.fields([
  { name: "questionFile", maxCount: 1 },
  { name: "solutionFile", maxCount: 1 },
]);

// ── Routes ────────────────────────────────────────────────────────────────────
router.post("/upload", protect, uploadFields, uploadQuestionBank);
router.get("/", protect, getAllQuestionBanks);
router.get("/my", protect, getMyQuestionBanks);
router.get("/:id/download", protect, downloadQuestionBankFile);
router.delete("/:id", protect, deleteQuestionBank);
router.put("/:id/solution", protect, upload.single("solutionFile"), addSolution);

module.exports = router;
