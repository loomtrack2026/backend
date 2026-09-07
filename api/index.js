const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("../config/mongoDns");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const connectDB = require("../config/db");
const { notFound, errorHandler } = require("../middleware/errorHandler");

connectDB();

const app = express();

// Keep the deployed frontend allowed even when CLIENT_URL only lists localhost.
// Additional frontend origins can be supplied as a comma-separated list.
const configuredOrigins = new Set([
  "https://frontend-elwe.vercel.app",
  ...(process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean),
]);
const isLocalDevelopmentOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // Native apps/Postman do not send an Origin header.
      if (
        !origin ||
        configuredOrigins.has(origin) ||
        isLocalDevelopmentOrigin(origin)
      ) {
        return callback(null, true);
      }

      const error = new Error(`CORS origin not allowed: ${origin}`);
      return callback(Object.assign(error, { status: 403 }));
    },
    credentials: true,
  })
);
// Raised from the 100kb default so requests containing base64-encoded
// images/files in the JSON body (e.g. SparePart.photo) aren't rejected.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Routes
app.use("/api/auth", require("../routes/authRoutes"));
app.use("/api/employees", require("../routes/employeeRoutes"));
app.use("/api/machines", require("../routes/machineRoutes"));
app.use("/api/maintenance", require("../routes/maintenanceRoutes"));
app.use("/api/oil-changes", require("../routes/oilChangeRoutes"));
app.use("/api/spare-parts", require("../routes/sparePartRoutes"));
app.use("/api/maintenance-jobs", require("../routes/maintenanceJobRoutes"));
app.use("/api/notifications", require("../routes/notificationRoutes"));
app.use("/api/dashboard", require("../routes/dashboardRoutes"));
app.use("/api/reports", require("../routes/reportRoutes"));
app.use("/api/leaves", require("../routes/leaveRoutes"));
app.use("/api/upload", require("../routes/uploadRoutes"));

const healthResponse = (req, res) =>
  res.json({ success: true, message: "MMS API is running" });

app.get("/", healthResponse);
app.get("/api/health", healthResponse);

app.use(notFound);
app.use(errorHandler);

// Vercel invokes the exported Express app. Keep a local listener only when
// this file is run directly for development.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
