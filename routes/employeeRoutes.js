const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/employeeController");

router.use(protect, authorize("general_manager"));

router.route("/").get(getEmployees).post(createEmployee);
router
  .route("/:id")
  .get(getEmployeeById)
  .put(authorize("general_manager"), updateEmployee)
  .delete(authorize("general_manager"), deleteEmployee);

module.exports = router;
