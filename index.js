const { existsSync } = require("node:fs");
const { join } = require("node:path");

const envFile = join(__dirname, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Import the Express module
const express = require("express");
const { sendLog } = require("./newrelic-logs");

// Initialize the Express application
const app = express();

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// Define a test GET endpoint
app.get("/api/status", (req, res) => {
  console.log(testee);
  const startedAt = performance.now();
  res.once("finish", () => {
    void sendLog({
      "http.method": req.method,
      "http.route": req.route.path,
      "http.statusCode": res.statusCode,
      "duration.ms": Math.round(performance.now() - startedAt),
    });
  });

  res.json({
    status: "online",
    message: "Welcome to your Node.js API!",
  });
});

app.post("/api/webhook", (req, res) => {
  console.log("=" * 28);
  console.log(req.body);
  res.json({
    status: "OK",
  });
});

// Set the API port
const PORT = process.env.PORT || 3000;

// Start the server and listen for requests
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
  });
}

module.exports = app;
