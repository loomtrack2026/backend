const asyncHandler = require("express-async-handler");
const Maintenance = require("../models/Maintenance");
const Machine = require("../models/Machine");
const Employee = require("../models/Employee");

const getEmployee = (userId) => Employee.findOne({ user: userId, isActive: true });

const assertReportAccess = async (req, res, record) => {
  if (req.user.role === "admin") return;
  const employee = await getEmployee(req.user._id);
  if (req.user.role === "employee" && String(record.performedBy) === String(employee?._id)) return;
  if (req.user.role === "general_manager") {
    const performer = await Employee.findOne({ _id: record.performedBy, manager: req.user._id });
    if (performer) return;
  }
  res.status(403);
  throw new Error("You are not permitted to access this maintenance report");
};

const createMaintenance = asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ _id: req.body.machine, isDeleted: false });
  if (!machine) {
    res.status(404);
    throw new Error("Machine not found");
  }
  let performedBy = req.body.performedBy;
  if (req.user.role === "employee") {
    const employee = await getEmployee(req.user._id);
    if (!employee?.assignedMachines.some((id) => String(id) === String(machine._id))) {
      res.status(403);
      throw new Error("You can only submit reports for assigned machines");
    }
    performedBy = employee._id;
  }
  const category = req.body.maintenanceCategory || "General";
  if (["Compressor", "Air Dryer"].includes(category)) {
    if (!Array.isArray(req.body.componentsChecked) || req.body.componentsChecked.length === 0) {
      res.status(400);
      throw new Error("Select at least one component to inspect");
    }
    const expectedType = category === "Compressor" ? "Compressor Maintenance" : "Air Dryer Maintenance";
    if (req.body.maintenanceType !== expectedType) {
      res.status(400);
      throw new Error("Invalid specialized maintenance type");
    }
  }
  const reportData = { ...req.body, performedBy };
  reportData.maintenanceCategory = category;
  if (category !== "General") reportData.engineerName = req.body.engineerName || req.user.name;
  if (req.user.role === "employee") {
    // Only a manager or admin may approve/reject a submitted employee report.
    reportData.approvalStatus = "Submitted";
    delete reportData.approvedBy;
    delete reportData.approvedAt;
  }
  const record = await Maintenance.create(reportData);
  // An employee logging an Idle maintenance record is reporting the current
  // machine state as well, so keep the machine card in sync.
  if (req.user.role === "employee" && record.maintenanceType === "Idle") {
    machine.status = "Idle";
    await machine.save();
  }
  res.status(201).json({ success: true, data: record });
});

const getMaintenanceRecords = asyncHandler(async (req, res) => {
  const { machine, page = 1, limit = 20 } = req.query;
  const query = {};
  if (machine) query.machine = machine;

  if (req.user.role === "employee") {
    const employee = await getEmployee(req.user._id);
    query.performedBy = employee?._id || null;
  } else if (req.user.role === "general_manager") {
    const employees = await Employee.find({ manager: req.user._id }).select("_id");
    query.performedBy = { $in: employees.map((employee) => employee._id) };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [records, total] = await Promise.all([
    Maintenance.find(query)
      .populate("machine", "machineName machineNumber")
      .populate("performedBy", "name employeeId")
      .sort({ maintenanceDate: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Maintenance.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: records,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

const getMaintenanceById = asyncHandler(async (req, res) => {
  const record = await Maintenance.findById(req.params.id)
    .populate("machine", "machineName machineNumber")
    .populate("performedBy", "name employeeId");
  if (!record) {
    res.status(404);
    throw new Error("Maintenance record not found");
  }
  await assertReportAccess(req, res, record);
  res.json({ success: true, data: record });
});

const updateMaintenance = asyncHandler(async (req, res) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error("Maintenance record not found");
  }
  await assertReportAccess(req, res, record);
  const updates = { ...req.body };
  if (updates.cost !== undefined) updates.cost = Number(updates.cost) || 0;
  if (!["admin", "owner"].includes(req.user.role)) delete updates.performedBy;
  if (Object.prototype.hasOwnProperty.call(updates, "nextMaintenanceDate")) {
    updates.reminderSent = false;
    updates.reminderSentAt = undefined;
  }
  if (req.user.role === "employee") {
    delete updates.approvalStatus;
    delete updates.approvedBy;
    delete updates.approvedAt;
  }
  if (req.user.role === "general_manager") {
    delete updates.approvedBy;
    delete updates.approvedAt;
    if (updates.approvalStatus) {
      updates.approvedBy = req.user._id;
      updates.approvedAt = new Date();
    }
  }
  Object.assign(record, updates);
  await record.save();
  res.json({ success: true, data: record });
});

const deleteMaintenance = asyncHandler(async (req, res) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error("Maintenance record not found");
  }
  await record.deleteOne();
  res.json({ success: true, message: "Maintenance record deleted" });
});

// @desc  Records whose nextMaintenanceDate is due today/overdue (scheduler use)
const getDueMaintenance = asyncHandler(async (req, res) => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const due = await Maintenance.find({
    nextMaintenanceDate: { $lte: endOfToday, $ne: null },
    reminderSent: false,
  }).populate({
    path: "machine",
    populate: { path: "assignedEmployees", select: "name phoneNumber email" },
  });

  res.json({ success: true, data: due });
});

const markReminderSent = asyncHandler(async (req, res) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error("Maintenance record not found");
  }
  record.reminderSent = true;
  record.reminderSentAt = new Date();
  await record.save({ validateBeforeSave: false });
  res.json({ success: true, data: record });
});

module.exports = {
  createMaintenance,
  getMaintenanceRecords,
  getMaintenanceById,
  updateMaintenance,
  deleteMaintenance,
  getDueMaintenance,
  markReminderSent,
};
