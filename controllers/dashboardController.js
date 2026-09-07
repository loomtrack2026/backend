const asyncHandler = require("express-async-handler");
const Machine = require("../models/Machine");
const Employee = require("../models/Employee");
const Maintenance = require("../models/Maintenance");
const OilChange = require("../models/OilChange");
const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

const getDashboardStats = asyncHandler(async (req, res) => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const employee = req.user.role === "employee"
    ? await Employee.findOne({ user: req.user._id, isActive: true }).select("assignedMachines")
    : null;
  const scheduleQuery = { nextMaintenanceDate: { $ne: null }, machine: { $exists: true } };
  if (employee) scheduleQuery.machine = { $in: employee.assignedMachines };
  const visibleEquipment = employee ? { _id: { $in: employee.assignedMachines } } : {};
  const regularMachineFilter = {
    ...visibleEquipment,
    isDeleted: false,
    $or: [{ assetType: "Machine" }, { assetType: { $exists: false } }],
  };
  const compressorFilter = { ...visibleEquipment, isDeleted: false, assetType: "Compressor" };
  const airDryerFilter = { ...visibleEquipment, isDeleted: false, assetType: "Air Dryer" };

  const [
    totalOwners,
    totalMachines,
    totalCompressors,
    totalAirDryers,
    runningMachines,
    breakdownMachines,
    underMaintenanceMachines,
    idleMachines,
    totalEmployees,
    maintenanceDue,
    oilChangeDue,
    upcomingMaintenance,
    recentActivity,
  ] = await Promise.all([
    User.countDocuments({ role: "owner", isActive: true }),
    Machine.countDocuments(regularMachineFilter),
    Machine.countDocuments(compressorFilter),
    Machine.countDocuments(airDryerFilter),
    Machine.countDocuments({ ...regularMachineFilter, status: "Running" }),
    Machine.countDocuments({ ...regularMachineFilter, status: "Breakdown" }),
    Machine.countDocuments({ ...regularMachineFilter, status: "Under Maintenance" }),
    Machine.countDocuments({ ...regularMachineFilter, status: "Idle" }),
    Employee.countDocuments({ isActive: true }),
    Maintenance.countDocuments({ nextMaintenanceDate: { $lte: endOfToday, $ne: null } }),
    OilChange.countDocuments({ nextOilChangeDate: { $lte: endOfToday }, reminderSent: false }),
    Maintenance.find(scheduleQuery)
      .populate("machine", "machineName machineNumber")
      .sort({ nextMaintenanceDate: 1 })
      .limit(12)
      .lean(),
    ActivityLog.find().sort({ createdAt: -1 }).limit(10).populate("user", "name role"),
  ]);

  const now = Date.now();
  const dueSoonLimit = now + 7 * 24 * 60 * 60 * 1000;
  const maintenanceSchedule = upcomingMaintenance.map((record) => ({
    _id: record._id,
    machine: record.machine,
    category: record.maintenanceCategory || "General",
    component: record.componentsChecked?.join(", ") || record.maintenanceType,
    nextMaintenanceDate: record.nextMaintenanceDate,
    scheduleStatus: new Date(record.nextMaintenanceDate).getTime() < now
      ? "Overdue"
      : new Date(record.nextMaintenanceDate).getTime() <= dueSoonLimit
        ? "Due Soon"
        : "Completed",
  }));

  res.json({
    success: true,
    data: {
      totalOwners,
      totalMachines,
      totalCompressors,
      totalAirDryers,
      runningMachines,
      breakdownMachines,
      underMaintenanceMachines,
      idleMachines,
      totalEmployees,
      maintenanceDue,
      oilChangeDue,
      maintenanceSchedule,
      recentActivity,
    },
  });
});

module.exports = { getDashboardStats };
