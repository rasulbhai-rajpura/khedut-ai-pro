export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, imageBase64, query, soilType, cropName, landArea, sowingDate, bioOption, bioArea, mandiYard, queryCrop } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key missing' });
  }

  const MODEL_NAME = "gemini-3.8-flash";

  if (type === "crop_mandi") {
    const crop = queryCrop || "જીરું";
    const defaultCropData = [
      { yard: "ઊંઝા", min: "5100", max: "6200", trend: "તેજી" },
      { yard: "થરાદ", min: "4850", max: "5750", trend: "સુધારો" },
      { yard: "ડીસા", min: "4800", max: "5600", trend: "સ્થિર" },
      { yard: "પાટણ", min: "4900", max: "5700", trend: "સુધારો" }
    ];

    try {
      const prompt = `Return 20kg market prices for crop ${crop} in Gujarat yards as JSON array: [{"yard":"ઊંઝા","min":"5100","max":"6200","trend":"તેજી"}]`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let cleanText = data.candidates[0].content.parts[0].text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
        return res.status(200).json({ success: true, data: JSON.parse(cleanText) });
      }
    } catch (e) {}
    return res.status(200).json({ success: true, data: defaultCropData });
  }

  if (type === "mandi") {
    const yard = mandiYard || "થરાદ";
    const defaultMandiData = [
      { crop: "જીરું (Cumin)", min: "4850", max: "5750", trend: "તેજી" },
      { crop: "રાયડો (Mustard)", min: "1490", max: "1565", trend: "સુધારો" },
      { crop: "એરંડા (Castor)", min: "1495", max: "1525", trend: "સ્થિર" },
      { crop: "ઈસબગુલ (Isabgol)", min: "2450", max: "3050", trend: "તેજી" },
      { crop: "ઘઉં (Wheat)", min: "540", max: "585", trend: "સ્થિર" },
      { crop: "બાજરી (Bajra)", min: "420", max: "540", trend: "સામાન્ય" },
      { crop: "મગફળી (Groundnut)", min: "1250", max: "1820", trend: "તેજી" },
      { crop: "રાજગરો (Rajgaro)", min: "1720", max: "1815", trend: "સ્થિર" },
      { crop: "મકાઈ (Maize)", min: "450", max: "530", trend: "સામાન્ય" }
    ];

    try {
      const prompt = `Return market prices for yard ${yard} as JSON array: [{"crop":"જીરું (Cumin)","min":"4850","max":"5750","trend":"તેજી"}]`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let cleanText = data.candidates[0].content.parts[0].text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
        return res.status(200).json({ success: true, data: JSON.parse(cleanText) });
      }
    } catch (e) {}
    return res.status(200).json({ success: true, data: defaultMandiData });
  }

  let promptText = "";
  let parts = [];

  if (type === "advisor") {
    promptText = `You are an expert agriculture scientist in North Gujarat (Banaskantha). Answer in Gujarati clearly: "${query}"`;
    parts = [{ text: promptText }];
  } else if (type === "planner") {
    promptText = `Soil: ${soilType}, Crop: ${cropName}, Area: ${landArea}. Give Gujarati fertilizer and seed schedule.`;
    parts = [{ text: promptText }];
  } else if (type === "calendar") {
    promptText = `Crop: ${cropName}, Sowing Date: ${sowingDate}. Give Gujarati stage-wise spray calendar.`;
    parts = [{ text: promptText }];
  } else if (type === "bio") {
    promptText = `Bio fertilizer: ${bioOption}, Area: ${bioArea}. Give Gujarati preparation steps and dosage.`;
    parts = [{ text: promptText }];
  } else {
    if (!imageBase64) return res.status(400).json({ error: 'Image required' });
    promptText = `Analyze crop leaf disease and respond ONLY in JSON: {"crop_name":"","disease_name":"","severity":"","symptoms":"","chemical_treatment":"","organic_treatment":"","prevention":""}. Note: ${query || 'None'}`;
    parts = [{ text: promptText }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }];
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] })
    });
    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      let text = data.candidates[0].content.parts[0].text.trim();
      let finalResult = (type === "disease") ? JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim()) : { textAnswer: text };
      return res.status(200).json({ success: true, data: finalResult });
    }
    return res.status(500).json({ success: false, error: "AI તરફથી પ્રતિસાદ મળ્યો નથી." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
