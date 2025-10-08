const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const speechToTextRoutes = require('./controllers/speech-to-text');
const textToSpeechRoutes = require('./controllers/text-to-speech');
// Route imports
const repoRoute = require('./routes/init');
const reposRoute = require('./routes/repos');
const stagingRoute = require('./routes/staging');
const statusRoute = require('./routes/status');
const commitRoute = require('./routes/commit');
const logsRoute = require('./routes/logs');
const branchRoute = require('./routes/branch');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 8080;
// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); // Create a WebSocket Server
// Middleware
// Handle WebSocket connection
wss.on('connection', (ws, req) => {


  try {
    // Verify the JSON Web Token
   ws.recognizeStream = null

    // Handle incoming messages
    ws.on('message', (message) => {
      console.log(`Received message`, message);
      speechToTextRoutes.handleMessage(ws, message);
      // textToSpeechRoutes.handleMessage(ws, message);
    });

    // Handle client disconnect: WebSocket close event
    ws.on('close', () => {
      console.log(`User disconnected`);
      textToSpeechRoutes.handleDisconnect();
    });

  } catch (err) {
    console.log(err)
    ws.close(1008, 'Invalid token');
  }
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/init', repoRoute);         // POST /repo/:repoName
app.use('/repos', reposRoute);       // GET /repos
app.use('/staging', stagingRoute);   // POST /staging/:repoName, GET /staging/:repoName/file/*
app.use('/status', statusRoute);     // GET /status/:repoName
app.use('/commit', commitRoute);     // POST /commit/:repoName
app.use('/logs', logsRoute);         // GET /logs/:repoName
app.use('/branch', branchRoute);     // POST /branch/:repoName

app.get('/', (req, res) => {
  res.send('Welcome to the API');
});

// Start server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
