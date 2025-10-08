// Import Google Cloud Text-to-Speech (TTS) and custom event system
const textToSpeech = require('@google-cloud/text-to-speech');
const eventEmitter = require('../routes/event-emitter');

// Initialize Google TTS client
const ttsClient = new textToSpeech.TextToSpeechClient({ projectId: 'gory-server' });

// Default setting for TTS
let languageCode = 'en-US'; // Default language
let voiceName = 'en-US-Standard-C'; // Default TTS voice
let isProcessing = false; // Track if TTS is currently processing

// Handle incoming WebSocket messages
module.exports.handleMessage = (ws, message) => {
  let data;
  try {
    data = JSON.parse(message);
  } catch (e) {
    console.error('Error parsing message:', e);
    return;
  }

  // If the client requests to generate speech audio
  if (data.type === 'generateTTS') {
    generateTTSHandler(data, ws);
  }
};

// Core function to generate and send TTS audio
const generateTTSHandler = async (data, ws) => {
  if (isProcessing) {
    console.log('TTS is already processing, ignoring new request');
    return; // Prevent simultaneous TTS requests
  }
  
  isProcessing = true; // Set processing flag
  const { text, analysis } = data;

  try {
    // Request Google to synthesize speech from text
    const [ttsResponse] = await ttsClient.synthesizeSpeech({
      input: { text: text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: 'MP3' }, // Return audio in MP3 format
    });
    
    // Convert the audio buffer into a base64 string
    const base64Audio = ttsResponse.audioContent.toString('base64');


    // Send back the TTS response along with the original text and optional analysis
    if (ws) {
      ws.send(JSON.stringify({
        type: 'gpt-response',
        text: text,
        audio: base64Audio,
        analysis: analysis,
      }));
    }

    // Notify other parts of the system that TTS is done
    eventEmitter.emit('ttsCompleted');

  } catch (error) {
    console.error('Error during TTS generation:', error);
    if (ws) {
      ws.send(JSON.stringify({ type: 'error', message: 'TTS generation failed' }));
    }
  } finally {
    isProcessing = false; // Reset processing flag to allow new requests
  }
};

// Clean up function for when a WebSocket client disconnects
module.exports.handleDisconnect = () => {
  // Remove lingering event listeners if needed, or perform cleanup for user
  eventEmitter.off('generateTTS', generateTTSHandler); 
  console.log(`Client has been cleaned up`);
};

// Listen for TTS generation requests via events (used by other modules)
eventEmitter.on('generateTTS', (data, ws) => {
  generateTTSHandler(data, ws); // Trigger TTS generation when event is received
});

// Listen for language/voice changes and update TTS config
eventEmitter.on('languageChange', (newLanguageCode, newVoiceName) => {
  languageCode = newLanguageCode;
  voiceName = newVoiceName;
});