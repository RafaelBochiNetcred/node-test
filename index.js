// Import the Express module
const express = require("express");

// Initialize the Express application
const app = express();

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// Define a test GET endpoint
app.get("/api/status", (req, res) => {
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
app.listen(PORT, () => {
  console.log(`Server is running smoothly on port ${PORT}`);
});
