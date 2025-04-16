// server.js

const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Clean response text
const cleanResponse = (text) => {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove special characters but keep letters (all langs) & numbers
    .replace(/\s{2,}/g, ' ')          // Collapse multiple spaces
    .trim();
};

// Prompt Generator
const generatePrompt = (type, input, profile, language = "hi") => {
  const { age, allergies, conditions } = profile;
  const allergyList = allergies.length ? allergies.join(", ") : "None";
  const conditionList = conditions.length ? conditions.join(", ") : "None";

  if (language === "en") {
    if (type === "medicine") {
      return `
        Profile:
        - Age: ${age}
        - Allergies: ${allergyList}
        - Conditions: ${conditionList}

        Is the medicine "${input}" suitable for this person?
        Please answer in these points:
        1. Is it safe?
        2. Any potential side effects?
        3. When should it be avoided?
        4. Alternative medicines?
        5. Additional advice.
        Keep the response simple and clear.
      `;
    } else if (type === "food") {
      return `
        Profile:
        - Age: ${age}
        - Allergies: ${allergyList}
        - Conditions: ${conditionList}

        Is "${input}" a good food item for this person?
        Please respond in points:
        1. Is it beneficial?
        2. Any harmful effects?
        3. Quantity or caution?
        4. Better alternatives?
        5. Additional advice.
        Keep the language simple and clear.
      `;
    } else {
      return `
        Profile:
        - Age: ${age}
        - Allergies: ${allergyList}
        - Conditions: ${conditionList}

        User question: "${input}"
        Please answer considering their profile, in clear bullet points.
      `;
    }
  } else {
    if (type === "medicine") {
      return `
        एक ${age} वर्षीय व्यक्ति की प्रोफ़ाइल:
        - एलर्जी: ${allergyList}
        - स्थितियाँ: ${conditionList}

        दवा "${input}" इस व्यक्ति के लिए उपयुक्त है?
        कृपया बिंदुओं में उत्तर दें:
        1. क्या यह सुरक्षित है?
        2. संभावित साइड इफेक्ट?
        3. किन स्थितियों में टालना चाहिए?
        4. वैकल्पिक दवाएं?
        5. अतिरिक्त सलाह।
      `;
    } else if (type === "food") {
      return `
        एक ${age} वर्षीय व्यक्ति की प्रोफ़ाइल:
        - एलर्जी: ${allergyList}
        - स्थितियाँ: ${conditionList}

        "${input}" नामक भोजन इस व्यक्ति के लिए कैसा है?
        कृपया नीचे बिंदुओं में बताएं:
        1. क्या यह लाभकारी है?
        2. कोई नकारात्मक प्रभाव?
        3. विशेष ध्यान या मात्रा?
        4. बेहतर विकल्प?
        5. अतिरिक्त सलाह।
      `;
    } else {
      return `
        एक ${age} वर्षीय व्यक्ति की प्रोफ़ाइल:
        - एलर्जी: ${allergyList}
        - स्थितियाँ: ${conditionList}

        उपयोगकर्ता का प्रश्न: "${input}"
        कृपया प्रोफ़ाइल को ध्यान में रखते हुए मुख्य बिंदुओं में उत्तर दें।
      `;
    }
  }
};

// Webhook route
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.queryResult || {};
    const { queryText, parameters = {} } = body;

    // Extract relevant data
    const type = parameters?.type || "general"; // 'medicine', 'food', or 'general'
    const input = parameters?.item || queryText;
    const language = parameters?.language || "hi";
    const profile = {
      age: parameters?.age || 30,
      allergies: parameters?.allergies || [],
      conditions: parameters?.conditions || []
    };

    // Generate prompt using user profile
    const prompt = generatePrompt(type, input, profile, language);

    // Make request to Gemini API
    const geminiPromise = axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }]
    });

    // Timeout control (4.5 seconds)
    const geminiResponse = await Promise.race([
      geminiPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4500))
    ]);

    // Extract and clean response
    let answer = geminiResponse?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                 "Unable to generate a response.";
    answer = cleanResponse(answer);

    return res.json({ fulfillmentText: answer });

  } catch (error) {
    console.error("Error:", error.message);
    return res.json({ fulfillmentText: "Unable to generate a response. Please try again.।" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
