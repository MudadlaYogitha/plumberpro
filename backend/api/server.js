const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const serverless = require("serverless-http");
require("dotenv").config();

const app = express();

// ✅ MongoDB connection reuse (safe for serverless)
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
  console.log("MongoDB connected");
}
connectDB();

// ✅ Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ Routes
app.use("/api/auth", require("../routes/auth"));
app.use("/api/bookings", require("../routes/bookings"));
app.use("/api/admin", require("../routes/admin"));
app.use("/api/upload", require("../routes/upload"));
app.use("/api/sms", require("../routes/webhook")); // Webhook route

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ✅ Export as serverless function
module.exports = serverless(app);
