const fs = require("fs");
const path = require("path");
const Material = require("../models/Material");
const { storage } = require("../config/firebase");
const { ref, uploadBytesResumable, getDownloadURL, deleteObject } = require("firebase/storage");

// @desc    Upload a study material
// @route   POST /api/materials/upload
// @access  Private
const uploadMaterial = async (req, res) => {
  try {
    const { title, description, subject, scheme, semester, branch } = req.body;

    if (!title || !scheme || !semester || !branch) {
      return res.status(400).json({
        message: "Title, Scheme, Semester, and Branch are required fields.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!storage) {
      return res.status(500).json({ message: "Firebase Storage is not configured on the server. Please define Firebase environment variables in your .env file." });
    }

    // Upload to Firebase Storage
    const uniqueName = `materials/${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
    const storageRef = ref(storage, uniqueName);
    const metadata = { contentType: req.file.mimetype };
    const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    const material = await Material.create({
      title,
      description: description || "",
      subject: subject || "",
      scheme,
      semester,
      branch,
      fileName: req.file.originalname,
      filePath: downloadUrl,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
    });

    res.status(201).json({
      message: "Material uploaded successfully",
      material,
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ message: "Server error during upload" });
  }
};

// @desc    Get all materials (everyone's uploads)
// @route   GET /api/materials
// @access  Private
const getAllMaterials = async (req, res) => {
  try {
    const materials = await Material.find()
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ count: materials.length, materials });
  } catch (error) {
    console.error("Get all materials error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get materials uploaded by the logged-in user
// @route   GET /api/materials/my
// @access  Private
const getMyMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ uploadedBy: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json({ count: materials.length, materials });
  } catch (error) {
    console.error("Get my materials error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get a single material by ID
// @route   GET /api/materials/:id
// @access  Private
const getMaterialById = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id).populate(
      "uploadedBy",
      "name email"
    );

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    res.status(200).json({ material });
  } catch (error) {
    console.error("Get material error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Download / serve a material file
// @route   GET /api/materials/:id/download
// @access  Private
const downloadMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    if (material.filePath && material.filePath.startsWith("http")) {
      return res.redirect(material.filePath);
    }

    const absolutePath = path.resolve(material.filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.download(absolutePath, material.fileName);
  } catch (error) {
    console.error("Download error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete a material (only by the uploader)
// @route   DELETE /api/materials/:id
// @access  Private
const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }

    // Ensure only the uploader can delete
    if (material.uploadedBy.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this material" });
    }

    // Remove file
    if (material.filePath) {
      if (material.filePath.startsWith("http")) {
        if (storage) {
          try {
            const fileRef = ref(storage, material.filePath);
            await deleteObject(fileRef);
          } catch (storageErr) {
            console.error("Error deleting from Firebase Storage:", storageErr.message);
          }
        } else {
          console.warn("Firebase Storage is not configured. Skipping cloud file deletion.");
        }
      } else {
        const absolutePath = path.resolve(material.filePath);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }
    }

    await material.deleteOne();

    res.status(200).json({ message: "Material deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  uploadMaterial,
  getAllMaterials,
  getMyMaterials,
  getMaterialById,
  downloadMaterial,
  deleteMaterial,
};
