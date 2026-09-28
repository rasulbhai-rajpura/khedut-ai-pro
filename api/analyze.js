export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { imageBase64, query } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'કૃપા કરીને પાક કે પાંદડાનો ફોટો અપલોડ કરો.' });
  }

  // સર્વરના સિક્રેટ Environment Variable માંથી કી લેશે
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'સર્વર પર Gemini API Key ઉપલબ્ધ નથી.' });
  }

  const promptText = `
તમે એક સર્વોચ્ચ કૃષિ વૈજ્ઞાનિક અને પાક રોગ સંરક્ષણ નિષ્ણાત છો.
ખાસ કરીને બનાસકાંઠા (વાવ, થરાદ, ધરણીધર) વિસ્તારના મુખ્ય પાકો (જીરું, રાયડો, મગફળી, કપાસ, દાડમ, એરંડા) ના સંદર્ભમાં આ રોગિષ્ટ પાંદડાનું વિશ્લેષણ કરો.
ખેડૂતનો પ્રશ્ન: "${query || 'આ પાંદડામાં કયો રોગ છે અને તેનો ઉપાય શું?'}"

જવાબ સંપૂર્ણપણે સરળ અને શુદ્ધ ગુજરાતી ભાષામાં, નીચે મુજબના વેલિડ JSON ફોર્મેટમાં જ આપો:
{
  "crop_name": "પાકનું નામ",
  "disease_name": "રોગનું સચોટ નામ",
  "severity": "રોગની તીવ્રતા (ઓછી / મધ્યમ / ગંભીર)",
  "symptoms": "મુખ્ય લક્ષણો અને રોગ થવાના કારણો",
  "chemical_treatment": "તાત્કાલિક રાસાયણિક દવાની ભલામણ અને છંટકાવનું પ્રમાણ",
  "organic_treatment": "દેશી/જૈવિક ઉપાયો (દા.ત. લીમડાનું અર્ક, ગૌમૂત્ર, ખાટી છાશ વગેરે)",
  "prevention": "ભવિષ્યમાં રોગ ન ફેલાય તે માટે સાવચેતીનાં પગલાં"
}
નોંધ: કોઈ પણ વધારાના લખાણ કે બેકટિક્સ (\`\`\`json) વગર માત્ર શુદ્ધ JSON જ પરત કરવો.
`;

  const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
  let finalJson = null;
  let lastError = "";

  for (let model of models) {
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

      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
        let rawText = data.candidates[0].content.parts[0].text.trim();
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        finalJson = JSON.parse(rawText);
        break;
      } else if (data.error) {
        lastError = data.error.message;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  if (finalJson) {
    return res.status(200).json({ success: true, data: finalJson });
  } else {
    return res.status(500).json({ success: false, error: lastError || "વિશ્લેષણ કરવામાં મુશ્કેલી આવી." });
  }
}
