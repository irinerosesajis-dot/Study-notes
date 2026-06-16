const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    scheme: {
      type: String,
      trim: true,
      default: "",
    },
    semester: {
      type: String,
      trim: true,
      default: "",
    },
    branch: {
      type: String,
      trim: true,
      default: "",
    },
    fileName: {
      type: String,
      required: true, // original file name
    },
    filePath: {
      type: String,
      required: true, // path on disk e.g. uploads/filename.pdf
    },
    fileType: {
      type: String, // mime type
    },
    fileSize: {
      type: Number, // bytes
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Material", materialSchema);
