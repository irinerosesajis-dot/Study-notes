const express = require("express");
const router = express.Router();
const { register, login, getMe, changePassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/me  (protected)
router.get("/me", protect, getMe);

// POST /api/auth/change-password (protected)
router.post("/change-password", protect, changePassword);

module.exports = router;
