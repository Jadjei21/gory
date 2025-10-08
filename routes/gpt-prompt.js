//gpt-prompt.js

// Import OpenAI SDK and event system
const OpenAI = require("openai");
const eventEmitter = require('./event-emitter');
const { raw } = require("express");
require('dotenv').config();
const  { GoogleGenAI } = require("@google/genai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ai = new GoogleGenAI({ apiKey:  process.env.GOOGLE_GENAI_API_KEY });
const commandSchemas = [
  {
    intent: 'create_branch',
    match: /create (?:a )?branch(?: (?:called|named))?\s+(?<branchName>[a-zA-Z0-9-_]+)/i,
    requiredParams: ['branchName']
  },
  {
    intent: 'create_repo',
    match: /create (?:a )?(?:repo|repository)(?: (?:called|named))?\s+(?<repoName>[a-zA-Z0-9-_]+)/i,
    requiredParams: ['repoName']
  },
  {
    intent: 'delete_branch',
    match: /delete (?:the )?branch(?: (?:named|called))?\s+(?<branchName>[a-zA-Z0-9-_]+)/i,
    requiredParams: ['branchName']
  },
  {
    intent: 'switch_branch',
    match: /switch (?:over )?(?:to )?(?:branch )?(?<branchName>[a-zA-Z0-9-_]+)/i,
    requiredParams: ['branchName']
  },
  {
    intent: 'merge_branch',
    match: /merge(?: (?:into|with))?\s+(?<targetBranch>[a-zA-Z0-9-_]+)/i,
    requiredParams: ['targetBranch']
  }
];
function classifyIntent(transcribedText) {
  for (const schema of commandSchemas) {
    const match = schema.match.exec(transcribedText);
    if (match?.groups) {
      const params = {};
      for (const param of schema.requiredParams) {
        if (match.groups[param]) {
          params[param] = match.groups[param];
        }
      }

      return {
        intent: schema.intent,
        params,
        missingParams: schema.requiredParams.filter(p => !(p in params))
      };
    }
  }

  return { intent: null, params: {}, missingParams: [] };
}


// Initialize OpenAI client
// const openai = new OpenAI({
//   // Should be stored in environment variable 
//   apiKey:  process.env.OPENAI_API_KEY, // Store your API key securely in environment variables
// });

// Define the initial system prompt to guide GPT behavior. Conversation history to store the conversation
const conversationHistory = [
  {
    role: "system",
   content: `You are an assistant that extracts concise developer command strings from casual or verbose speech.

Convert the user's speech into a short, structured command string.

Examples:
-"Can you make a repo called workable" →"create repo workable"
- "Can you make a branch called login?" → "create branch login"
- "I'd like to switch to dev" → "switch to dev"
- "Please merge to main now" → "merge main"
- "Go ahead and delete the test branch" → "delete branch test"
-"What can I geve as the name" → "suggest name"
Only output the cleaned-up command string, no extra text.


`
  },
];

// Flag to ensure TTS isn’t triggered multiple times in parallel
let isTTSInProgress = false;

// On full speech-to-text transcription from user
eventEmitter.on('transcriptionComplete', async (transcript, ws) => {
  // Add user message to chat history
  // conversationHistory.push({ role: "user", content: JSON.stringify(transcript) });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages:[{role:'user', content: `
You are a helpful AI assistant. Your job is to extract a **short, structured developer command** from casual or verbose speech input.

Your response should contain only the cleaned command. Do NOT guess — stay true to the user's actual request.

Examples:
- "Can you make a branch called login?" → "create branch login"
- "I'd like to switch to dev" → "switch to dev"
- "Please delete the branch called test" → "delete branch test"
- "Can you create a repo called Insight?" → "create repo Insight"
- "Switch to branch master" → "switch to master"
- "I want to merge dev into main" → "merge main"

Avoid hallucinating or adding actions. Stick to what the user requested.

User input: "${transcript}"

Cleaned command:
`}],
      temperature: 0,
    });
    console.log("Respoonse", response.choices[0].message.content.trim())
    intentData = classifyIntent(response.choices[0].message.content.trim());
    ws.send(JSON.stringify({ type: 'intent', intentData }));
    // Emit the full response and words to TTS generator if not already in progress
    // Convert GPT response to speech if not already processing
    // if (!isTTSInProgress) {
    //   isTTSInProgress = true; // Set the flag to indicate TTS is in progress
    //   const responseText = rawContent.response;
    //   eventEmitter.emit('generateTTS', {
    //     text: responseText,
    //     analysis: rawContent.analysis,
    //   }, ws);
    // }

  } catch (error) {
    console.error('Error with OpenAI API:', error);
  }
});

// Listen for TTS completion to reset the flag
eventEmitter.on('ttsCompleted', () => {

  isTTSInProgress = false; // Reset the flag when TTS is done
});
