export default async function handler(req, res) {
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
    bioArea 
  } = req.body;

  // ૧. લાઈવ APMC બજાર ભાવ (Gemini Direct REST API + Google Search)
  if (type === "live_mandi" || type === "crop_mandi" || type === "mandi") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY ખૂટે છે.' });
    }

    const targetQuery = queryCrop || mandiYard || "ગુજરાત APMC";
    const prompt = `Search Google for the latest APMC market prices in Gujarat for "${targetQuery}".
Provide prices per 20 kg (મણ) in Gujarati.
Return ONLY a valid JSON array of objects without markdown code blocks:
[
  {"name": "પાક અથવા યાર્ડ", "min": 1200, "max": 1500, "trend": "તેજી/સ્થિર/સુધારો"}
]`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }] // લાઈવ વેબ સર્ચ
          })
        }
      );

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let rawText = data.candidates[0].content.parts[0].text.trim();
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);
        return res.status(200).json({ success: true, data: parsed });
      } else {
        return res.status(500).json({ success: false, error: 'ભાવ ઉપલબ્ધ નથી.' });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ૨. અન્ય કૃષિ સલાહ અને કેલેન્ડર ફીચર્સ
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ success: false, error: 'GROQ_API_KEY ખૂટે છે.' });
  }

  let promptText = "";
  if (type === "advisor") promptText = "કૃષિ સલાહ આપો: " + query;
  else if (type === "planner") promptText = `જમીન: ${soilType}, પાક: ${cropName}, માપ: ${landArea}`;
  else if (type === "calendar") promptText = `પાક: ${cropName}, વાવણી: ${sowingDate}`;
  else if (type === "bio") promptText = `પ્રાકૃતિક ખાતર: ${bioOption}, માપ: ${bioArea}`;
  else if (type === "disease") promptText = `પાક રોગ નિદાન: ${query || 'પાક રોગ'}`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "તમે ખેડૂત મિત્ર AI છો. શુદ્ધ ગુજરાતીમાં જવાબ આપો." },
          { role: "user", content: promptText }
        ],
        temperature: 0.3
      })
    });

    const d = await groqRes.json();
    if (d.choices && d.choices[0]?.message?.content) {
      const text = d.choices[0].message.content.trim();
      let finalResult = (type === "disease") ? JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim()) : { textAnswer: text };
      return res.status(200).json({ success: true, data: finalResult });
    }
    return res.status(500).json({ success: false, error: "AI તરફથી જવાબ મળ્યો નથી." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
