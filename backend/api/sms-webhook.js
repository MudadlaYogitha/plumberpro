import express from "express";
import serverless from "serverless-http";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/sms/webhook", (req, res) => {
  console.log("Incoming webhook:", req.body);
  res.json({ success: true, message: "POST received on webhook" });
});

export default serverless(app);
