const express = require("express");
const router = express.Router();
const { protect, authorize, requireSchedulerKey } = require("../middleware/auth");
const {
  createOilChange,
  getOilChanges,
  getOilChangeById,
  updateOilChange,
  deleteOilChange,
  getDueOilChanges,
  markReminderSent,
} = require("../controllers/oilChangeController");

// Scheduler-only endpoints (separate auth: shared API key, no user JWT)
router.get("/due/today", requireSchedulerKey, getDueOilChanges);
router.patch("/:id/mark-reminder-sent", requireSchedulerKey, markReminderSent);

// Normal user-facing endpoints
router.use(protect);

router.route("/").get(getOilChanges).post(createOilChange);

router
  .route("/:id")
  .get(getOilChangeById)
  .put(updateOilChange)
  .delete(authorize("owner"), deleteOilChange);

module.exports = router;
