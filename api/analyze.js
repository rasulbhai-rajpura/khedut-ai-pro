export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, imageBase64, query, soilType, cropName, landArea, sowingDate, bioOption, bioArea, mandiYard, queryCrop } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY સર્વર પર મળતી નથી. Vercel Settings તપાસો.' });
  }

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

  if (type === "crop_mandi") {
    const crop = queryCrop || "જીરું";
    const defaultCropData = [
      { yard: "ઊંઝા", min: "5100", max: "6200", trend: "તેજી" },
      { yard: "થરાદ", min: "4850", max: "5750", trend: "સુધારો" },
      { yard: "ડીસા", min: "4800", max: "5600", trend: "સ્થિર" },
      { yard: "પાટણ", min: "4900", max: "5700", trend: "સુધારો" }
    ];
    return res.status(200).json({ success: true, data: defaultCropData });
  }

  if (type === "mandi") {
    const defaultMandiData = [
      { crop: "જીરું (Cumin)", min: "4850", max: "5750", trend: "તેજી" },
      { crop: "રાયડો (Mustard)", min: "1490", max: "1565", trend: "સુધારો" },
      { crop: "એરંડા (Castor)", min: "1495", max: "1525", trend: "સ્થિર" },
      { crop: "ઈસબગુલ (Isabgol)", min: "2450", max: "3050", trend: "તેજી" },
      { crop: "ઘઉં (Wheat)", min: "540", max: "585", trend: "સ્થિર" }
    ];
    return res.status(200).json({ success: true, data: defaultMandiData });
  }

  let promptText = "";
  let parts = [];

  if (type === "advisor") {
    promptText = "You are an expert agriculture scientist in North Gujarat (Banaskantha). Answer in Gujarati clearly: " + query;
    parts = [{ text: promptText }];
  } else if (type === "planner") {
    promptText = "Soil: " + soilType + ", Crop: " + cropName + ", Area: " + landArea + ". Give Gujarati fertilizer and seed schedule.";
    parts = [{ text: promptText }];
  } else if (type === "calendar") {
    promptText = "Crop: " + cropName + ", Sowing Date: " + sowingDate + ". Give Gujarati stage-wise spray calendar.";
    parts = [{ text: promptText }];
  } else if (type === "bio") {
    promptText = "Bio fertilizer: " + bioOption + ", Area: " + bioArea + ". Give Gujarati preparation steps and dosage.";
    parts = [{ text: promptText }];
  } else {
    if (!imageBase64) return res.status(400).json({ success: false, error: 'ઇમેજ જરૂરી છે' });
    promptText = "Analyze crop leaf disease and respond ONLY in JSON: {\"crop_name\":\"\",\"disease_name\":\"\",\"severity\":\"\",\"symptoms\":\"\",\"chemical_treatment\":\"\",\"organic_treatment\":\"\",\"prevention\":\"\"}. Note: " + (query || 'None');
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    parts = [
      { text: promptText },
      { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }
    ];
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await response.json();

    // જો ગૂગલ તરફથી એરર આવે તો તે ચોક્કસ એરર પાછી મોકલશે
    if (data.error) {
      return res.status(500).json({ success: false, error: "Google API ભૂલ: " + (data.error.message || JSON.stringify(data.error)) });
    }

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      let text = data.candidates[0].content.parts[0].text.trim();
      let finalResult = (type === "disease") ? JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim()) : { textAnswer: text };
      return res.status(200).json({ success: true, data: finalResult });
    }

    return res.status(500).json({ success: false, error: "AI તરફથી અમાન્ય જવાબ: " + JSON.stringify(data) });
  } catch (err) {
    return res.status(500).json({ success: false, error: "સર્વર એરર: " + err.message });
  }
}
