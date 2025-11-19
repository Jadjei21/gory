const OpenAI = require("openai");
const eventEmitter = require('./event-emitter');
require('dotenv').config();



const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Use environment variable for API key
});

// Collected results for all necessary data points
let collectedResults = {
  crunchBaseApi: null,
  fundingOpportunities: 'black ambition',
  // stockApi: null,
  reportConcluded: null,
};

 

// Function to generate the business plan using collected data
async function generateBusinessPlan(req) {
  try {
    console.log("Generating business plan with collected data:", collectedResults);

    const inputForGPT = `
Market Analysis: ${collectedResults.crunchBaseApi}
Funding Opportunities: ${collectedResults.fundingOpportunities}
Financial Analysis: ${collectedResults.reportConcluded}
    `;

    // Generate the business plan using OpenAI API / ESG Analysis: ${collectedResults.stockApi}
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "Generate a comprehensive business plan based on the provided data. Make it very elaborate or up to 5 pages. Dont include any confidential information e.g token, api keys" },
        { role: "user", content: inputForGPT },
      ],
      temperature: 0.5,
    });

  } catch (error) {
    console.error("Error generating business plan:", error);
  }
}


eventEmitter.on('crunchbaseApi', (data) => {
  console.log('crunchbase data');
  getcrunchBaseApiResult(data);
  // collectedResults.
});
// Mock functions to simulate data collection from external APIs
async function getcrunchBaseApiResult(data) {
  collectedResults.crunchBaseApi = data;
  return data;
}

async function getFundingOpportunitiesResult() {
  return 'Black ambition';
}

async function getStockApiResult() {
  return 'Sample ESG Analysis data';
}

// Export the generateBusinessPlan function for external use
module.exports = {
  generateBusinessPlan,
};

// Example call to simulate data loading
(async () => {
  // Load other data asynchronously (e.g., from APIs)
  collectedResults.crunchBaseApi = await getcrunchBaseApiResult();
  collectedResults.fundingOpportunities = await getFundingOpportunitiesResult();
  // collectedResults.stockApi = await getStockApiResult();

  // Trigger the reportConcluded event with sample data to test the setup
  eventEmitter.emit('reportConcluded', { testConversation: "Sample conversation history" });
})();
