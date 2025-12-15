const { ServiceBroker } = require("moleculer");
const express = require("express");
const cors = require("cors");

// Create broker
const broker = new ServiceBroker({
    logger: true,
    hotReload: true,
    // Disable built-in transporter if not needed, or keep it default
});

// Load services
broker.loadServices("./services");

// Create Express app
const app = express();
app.use(express.json());
app.use(cors());

// Define routes that call Moleculer services
app.get("/api/items/available", async (req, res) => {
    try {
        const result = await broker.call("items.listAvailable", req.query);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/api/items/selected", async (req, res) => {
    try {
        const result = await broker.call("items.listSelected", req.query);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post("/api/items/add", async (req, res) => {
    try {
        const result = await broker.call("items.addItem", req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post("/api/items/modify", async (req, res) => {
    try {
        const result = await broker.call("items.modify", req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
const path = require("path");

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "frontend/dist")));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend/dist/index.html"));
});

broker.start().then(() => {
    app.listen(PORT, () => {
        console.log(`Express server running on port ${PORT}`);
    });
});
