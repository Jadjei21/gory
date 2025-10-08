// Import necessary modules
const express = require('express');
const speech = require('@google-cloud/speech');
const eventEmitter = require('../routes/event-emitter');

// Initialize Google Speech client
const client = new speech.SpeechClient({ projectId: 'gory-server' });

// Helper function to clean up a recognition stream
function cleanupRecognizeStream(recognizeStream) {
  if (recognizeStream) {
    recognizeStream.end();
    recognizeStream.removeAllListeners();
  }
}

// Exported function to handle incoming WebSocket messages
module.exports.handleMessage = (ws, message) => {
  let data;
  let timeout;

  // Try to parse incoming messages as JSON
  try {
    data = JSON.parse(message);
    console.log('Received data:', data);
  } catch (e) {
    data = null;
  }

  if (data && typeof data === 'object') {
    // Handle control messages like language selection or response completion

    // Change the language for speech recognition
    if (data.action === 'responseComplete') {
      console.log('Response complete. Emitting final transcription');

      // Emit an event with the final transcription result
      eventEmitter.emit('transcriptionComplete', data.text, ws);
    }

  } else {
    // Handle binary audio data (WebM/Opus)
    
    // Initialize a new recognition stream if it doesn't exist
    if (!ws.recognizeStream) {
      ws.recognizeStream = client.streamingRecognize({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 16000,
          languageCode: 'en-US', // Default to English if unspecified
        },
        interimResults: true, // Allow partial transcripts
      })
        .on('data', (response) => {
          // When a transcription result is received
          const transcriptObject = response.results[0];
          console.log("Sent transcript to frontend user.");
          ws.send(JSON.stringify({ type: 'transcription', transcriptObject, }));
        

          // Emit a paritial transcription after delay
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => {
            if (transcriptObject?.alternatives[0]?.transcript) {
              eventEmitter.emit('transcriptionPartial', transcriptObject.alternatives[0].transcript);
            }
          }, 500); // Delay to group responses
        })
        .on('error', (err) => {
          // Handle eros in the recognition stream
          console.error('Recognition stream error:', err);
          cleanupRecognizeStream(ws.recognizeStream);
          ws.recognizeStream = null;
        });
    }

    // Write audio message to the recognition stream
    if (ws.recognizeStream) {
      ws.recognizeStream.write(message);
    }
  }
}

