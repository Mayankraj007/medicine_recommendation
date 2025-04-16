const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Clean response text
const cleanResponse = (text) => {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, "") // Keep letters (all langs) and numbers
    .replace(/\s{2,}/g, " ")
    .trim();
};

// Prompt Generator
const generatePrompt = (type, input, language = "hi") => {
  const profile = {
    age: 42,
    allergies: ["Ibuprofen", "Shellfish"],
    conditions: ["Asthma", "High Cholesterol"],
  };

  const { age, allergies, conditions } = profile;
  const allergyList = allergies.length ? allergies.join(", ") : "None";
  const conditionList = conditions.length ? conditions.join(", ") : "None";

  // ENGLISH PROMPTS
  if (language === "en") {
    if (type === "medicine") {
      return `
        Health Profile:
        - Age: ${age}
        - Allergies: ${allergyList}
        - Conditions: ${conditionList}

        Is the medicine "${input}" suitable for this person?

        Please answer:
        1. Is it safe?
        2. Possible side effects?
        3. When should it be avoided?
        4. Better alternatives?
        5. Any additional advice.
      `;
    } else if (type === "food") {
      return `
        Health Profile:
        - Age: ${age}
        - Allergies: ${allergyList}
        - Conditions: ${conditionList}

        Is eating "${input}" good for this person?

        Please answer:
        1. Is it beneficial?
        2. Any harmful effects?
        3. Recommended quantity or caution?
        4. Better alternatives?
        5. Additional health advice.
      `;
    } else {
      return `
        Health Profile:
        - Age: ${age}
        - Allergies: ${allergyList}
        - Conditions: ${conditionList}

        Question: "${input}"

        Please answer in simple bullet points considering the profile.
      `;
    }
  }

  // HINDI PROMPTS
  else {
    if (type === "medicine") {
      return `
        स्वास्थ्य प्रोफ़ाइल:
        - उम्र: ${age}
        - एलर्जी: ${allergyList}
        - स्थितियाँ: ${conditionList}

        क्या दवा "${input}" इस व्यक्ति के लिए उपयुक्त है?

        कृपया बिंदुओं में उत्तर दें:
        1. क्या यह सुरक्षित है?
        2. साइड इफेक्ट्स?
        3. कब न लें?
        4. विकल्प?
        5. अन्य सलाह।
      `;
    } else if (type === "food") {
      return `
        स्वास्थ्य प्रोफ़ाइल:
        - उम्र: ${age}
        - एलर्जी: ${allergyList}
        - स्थितियाँ: ${conditionList}

        क्या "${input}" खाना इस व्यक्ति के लिए ठीक है?

        उत्तर दें:
        1. क्या यह लाभकारी है?
        2. कोई नुकसान?
        3. मात्रा या सावधानी?
        4. बेहतर विकल्प?
        5. सलाह।
      `;
    } else {
      return `
        स्वास्थ्य प्रोफ़ाइल:
        - उम्र: ${age}
        - एलर्जी: ${allergyList}
        - स्थितियाँ: ${conditionList}

        उपयोगकर्ता का प्रश्न: "${input}"

        कृपया इस प्रोफ़ाइल को ध्यान में रखकर बिंदुओं में उत्तर दें।
      `;
    }
  }
};

// Webhook route
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body.queryResult || {};
    const queryText = body.queryText || "Hello";
    const parameters = body.parameters || {};

    const type = parameters.type || "general";
    const item = parameters.item || queryText;
    const language = parameters.language || "en";

    const prompt = generatePrompt(type, item, language);
    console.log(`📝 Prompt:\n${prompt}`);

    const geminiPromise = axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );

    const geminiResponse = await Promise.race([
      geminiPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 7000)
      ),
    ]);

    let answer =
      geminiResponse?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Unable to generate a response.";
    console.log("✅ Raw response:", answer);
    answer = cleanResponse(answer);

    return res.json({ fulfillmentText: answer });
  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.json({
      fulfillmentText: "Unable to generate a response. Please try again.",
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
