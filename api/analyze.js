export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { imageBase64, query } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'કૃપા કરીને પાક કે પાંદડાનો ફોટો અપલોડ કરો.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'સર્વર પર Gemini API Key ઉપલબ્ધ નથી.' });
  }

  const promptText = `
તમે એક કૃષિ વૈજ્ઞાનિક અને પાક રોગ સંરક્ષણ નિષ્ણાત છો.
બનાસકાંઠા (વાવ, થરાદ, ધરણીધર) વિસ્તારના સંદર્ભમાં આ પાંદડાનું વિશ્લેષણ કરો.
ખેડૂતનો પ્રશ્ન: "${query || 'આ પાંદડામાં કયો રોગ છે અને તેનો ઉપાય શું?'}"

જવાબ માત્ર નીચે મુજબના JSON ફોર્મેટમાં જ આપવો:
{
  "crop_name": "પાકનું નામ",
  "disease_name": "રોગનું સચોટ નામ",
  "severity": "રોગની તીવ્રતા (ઓછી / મધ્યમ / ગંભીર)",
  "symptoms": "મુખ્ય લક્ષણો અને કારણો",
  "chemical_treatment": "રાસાયણિક દવા અને પ્રમાણ",
  "organic_treatment": "દેશી અને જૈવિક ઉપાયો",
  "prevention": "સાવચેતીનાં પગલાં"
}
નોંધ: કોઈ પણ વધારાના લખાણ કે માર્કડાઉન વગર માત્ર શુદ્ધ JSON જ આપવો.
`;

  // વારાફરતી પ્રયાસ કરવા માટે સક્રિય મોડેલ્સની લિસ્ટ
  const candidateModels = [
    "gemini-3.5-flash-lite"
  ];

  let finalJson = null;
  let lastError = "";

  for (let model of candidateModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64
                }
              }
            ]
          }]
        })
      });

      const data = await response.json();

      // જો સફળતાપૂર્વક જવાબ મળી જાય
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let rawText = data.candidates[0].content.parts[0].text.trim();
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        finalJson = JSON.parse(rawText);
        break; // જવાબ મળી ગયો એટલે લૂપમાંથી બહાર નીકળી જવું
      } 
      
      // જો ગૂગલ તરફથી હાઈ ડિમાન્ડ કે અન્ય એરર આવે તો ભૂલ નોંધી આગળના મોડેલ પર જવું
      if (data.error) {
        lastError = data.error.message;
        continue;
      }
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  if (finalJson) {
    return res.status(200).json({ success: true, data: finalJson });
  } else {
    return res.status(500).json({ success: false, error: lastError || "સર્વર વ્યસ્ત છે. કૃપા કરીને 5 સેકન્ડ પછી ફરી પ્રયાસ કરો." });
  }
}
