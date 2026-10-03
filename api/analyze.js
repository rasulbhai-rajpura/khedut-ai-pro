import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // માત્ર POST રિક્વેસ્ટ સ્વીકારો
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { 
    type, 
    queryCrop, 
    mandiYard, 
    query, 
    soilType, 
    cropName, 
    landArea, 
    sowingDate, 
    bioOption, 
    bioArea, 
    imageBase64 
  } = req.body;

  // ૧. લાઈવ APMC બજાર ભાવ (ગૂગલ લાઈવ સર્ચ ગ્રાઉન્ડિંગ સાથે)
  if (type === "live_mandi" || type === "crop_mandi" || type === "mandi") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY સેટ નથી. Vercel Environment Variables માં ઉમેરો.' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const targetQuery = queryCrop || mandiYard || "ગુજરાત મુખ્ય યાર્ડ";
      const prompt = `Search Google for the latest real-time APMC market prices in Gujarat for "${targetQuery}".
Provide the prices per 20 kg (મણ) in Gujarati.
Return ONLY a valid JSON array of objects without markdown formatting or code blocks:
[
  {"name": "જણસ અથવા યાર્ડનું નામ", "min": 1200, "max": 1550, "trend": "તેજી/સુધારો/સ્થિર/નરમ"}
]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }] // લાઈવ વેબ સર્ચ
        }
      });

      let text = response.text.trim();
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(text);
      return res.status(200).json({ success: true, data: parsedData });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'લાઈવ ભાવ મેળવવામાં ભૂલ: ' + err.message });
    }
  }

  // ૨. ખેડૂત સલાહકાર, પાક રોગ, કેલેન્ડર, પ્લાનર (Groq / Gemini સપોર્ટ)
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ success: false, error: 'GROQ_API_KEY સર્વર પર સેટ નથી.' });
  }

  let promptText = "";
  if (type === "advisor") {
    promptText = "You are an expert agriculture scientist in North Gujarat. Answer in simple Gujarati with medicine names: " + query;
  } else if (type === "planner") {
    promptText = `Soil: ${soilType}, Crop: ${cropName}, Area: ${landArea}. Give Gujarati fertilizer and seed schedule.`;
  } else if (type === "calendar") {
    promptText = `Crop: ${cropName}, Sowing Date: ${sowingDate}. Give Gujarati stage-wise spray calendar.`;
  } else if (type === "bio") {
    promptText = `Bio fertilizer: ${bioOption}, Area: ${bioArea}. Give Gujarati preparation steps and dosage.`;
  } else if (type === "disease") {
    promptText = `Provide plant disease cure in Gujarati JSON: {"crop_name":"","disease_name":"","severity":"","symptoms":"","chemical_treatment":"","organic_treatment":"","prevention":""}. Query: ${query || 'પાક રોગ'}`;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "તમે ખેડૂત મિત્ર AI છો. ઉત્તર શુદ્ધ અને સરળ ગુજરાતીમાં જ આપો." },
          { role: "user", content: promptText }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]?.message?.content) {
      const text = data.choices[0].message.content.trim();
      let finalResult = (type === "disease") ? JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim()) : { textAnswer: text };
      return res.status(200).json({ success: true, data: finalResult });
    }
    return res.status(500).json({ success: false, error: "AI તરફથી યોગ્ય જવાબ મળ્યો નથી." });
  } catch (err) {
    return res.status(500).json({ success: false, error: "સર્વર ભૂલ: " + err.message });
  }
}
