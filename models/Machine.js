const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema(
  {
    assetType: {
      type: String,
      enum: ["Machine", "Compressor", "Air Dryer"],
      default: "Machine",
    },
    machineId: { type: String, required: true, unique: true, trim: true },
    machineName: { type: String, required: true, trim: true },
    machineNumber: { type: String, required: true, unique: true, trim: true },
    machineType: { type: String, trim: true },
    company: { type: String, trim: true },
    modelNumber: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    purchaseDate: { type: Date },
    installationDate: { type: Date },
    warrantyExpiry: { type: Date },
    machineImage: { type: String, default: "" },
    layout: {
      width: { type: Number, default: 2, min: 1 },
      length: { type: Number, default: 2, min: 1 },
      machineCount: { type: Number, min: 1 },
      isLocked: { type: Boolean, default: true },
      lockedAt: { type: Date },
      lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    status: {
      type: String,
      enum: ["Running", "Under Maintenance", "Breakdown", "Idle"],
      default: "Running",
    },
    assignedEmployees: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    ],
    documents: [{ type: String }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

machineSchema.index({ machineName: "text", machineNumber: "text" });

module.exports = mongoose.model("Machine", machineSchema);
