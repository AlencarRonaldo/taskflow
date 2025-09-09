const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const HTTP_PORT = 8001;

app.get("/", (req, res) => {
    res.json({"message": "Test server is running"});
});

app.get("/api/test", (req, res) => {
    res.json({"message": "API test endpoint working"});
});

app.listen(HTTP_PORT, () => {
    console.log(`Test server running on port ${HTTP_PORT}`);
});

console.log("Server script executed");