const connectDB = require("../config/db");

module.exports = async (req, res, next) => {
  if (await connectDB()) return next();
  return res.status(503).json({
    success: false,
    message: "The database is temporarily unavailable. Please try again shortly.",
  });
};
