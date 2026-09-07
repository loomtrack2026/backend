const express = require("express");
const router = express.Router();
const { protect, authorize, requireSchedulerKey } = require("../middleware/auth");
const { requestReport, getReports, downloadReport, deleteReport, completeReport } = require("../controllers/reportController");

router.patch("/:id/complete", requireSchedulerKey, completeReport);

router.use(protect);
// Generated exports are available to operational roles that need them.
router
  .route("/")
  .get(authorize("admin", "owner", "general_manager", "employee"), getReports)
  .post(authorize("employee"), requestReport);
router.get("/:id/download", authorize("admin", "owner", "general_manager", "employee"), downloadReport);
router.delete("/:id", authorize("admin", "owner", "general_manager", "employee"), deleteReport);

module.exports = router;
