const express = require('express');
const cors = require('cors'); // Correctly import the cors module
const port = process.env.PORT || 5000;

const app = express(); // You also need to initialize express by creating an app instance

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send("The Fitness server is running");
});

app.listen(port, () => {
    console.log(`The Fitness server is running on port ${port}`);
});