const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const {
  uploadMaterial,
  getAllMaterials,
  getMyMaterials,
  getMaterialById,
  downloadMaterial,
  deleteMaterial,
} = require("../controllers/materialController");

// ── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.memoryStorage();


// Allow common document & media types
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
    "video/mp4",
    "audio/mpeg",
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

// ── Routes ────────────────────────────────────────────────────────────────────

// POST   /api/materials/upload   — upload a file (protected)
router.post("/upload", protect, upload.single("file"), uploadMaterial);

// GET    /api/materials          — list all materials (protected)
router.get("/", protect, getAllMaterials);

// GET    /api/materials/my       — list current user's uploads (protected)
router.get("/my", protect, getMyMaterials);

// GET    /api/materials/:id      — get one material (protected)
router.get("/:id", protect, getMaterialById);

// GET    /api/materials/:id/download — download file (protected)
router.get("/:id/download", protect, downloadMaterial);

// DELETE /api/materials/:id      — delete (uploader only, protected)
router.delete("/:id", protect, deleteMaterial);

module.exports = router;
