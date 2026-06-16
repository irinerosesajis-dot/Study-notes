const mongoose = require("mongoose");

const questionBankSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    scheme: {
      type: String,
      required: [true, "Scheme is required"],
      trim: true,
    },
    semester: {
      type: String,
      required: [true, "Semester is required"],
      trim: true,
    },
    branch: {
      type: String,
      required: [true, "Branch is required"],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
    },
    questionFileName: {
      type: String,
      required: true,
    },
    questionFilePath: {
      type: String,
      required: true,
    },
    questionFileType: {
      type: String,
    },
    questionFileSize: {
      type: Number,
    },
    solutionFileName: {
      type: String,
      default: null,
    },
    solutionFilePath: {
      type: String,
      default: null,
    },
    solutionFileType: {
      type: String,
      default: null,
    },
    solutionFileSize: {
      type: Number,
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuestionBank", questionBankSchema);
