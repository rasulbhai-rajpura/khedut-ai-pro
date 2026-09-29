const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, imageBase64, query, soilType, cropName, landArea } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key સેટ કરેલ નથી.' });
  }

  let promptText = "";
  let parts = [];

  if (type === "advisor") {
    promptText = `
તમે એક અનુભવી કૃષિ વૈજ્ઞાનિક અને ખેડૂતના સાચા મિત્ર છો.
ગુજરાત (ખાસ કરીને બનાસકાંઠા, વાવ, થરાદ, ધરણીધર) વિસ્તારના સંદર્ભમાં ખેડૂતના નીચેના પ્રશ્નનો ખૂબ જ સરળ, વ્યવહારુ અને ગામઠી ગુજરાતી ભાષામાં સચોટ જવાબ આપો.
જવાબ મુદ્દાસર આપવો જેમાં જરૂર હોય ત્યાં દેશી ઉપાય અને રાસાયણિક ઉપાય બંને સ્પષ્ટ જણાવવા.

ખેડૂતનો પ્રશ્ન: "${query}"
`;
    parts = [{ text: promptText }];
  } else if (type === "planner") {
    promptText = `
તમે એક કૃષિ અર્થશાસ્ત્રી અને પાક ઉત્પાદન નિષ્ણાત છો.
ખેડૂતની વિગતો નીચે મુજબ છે:
- જમીનનો પ્રકાર: ${soilType}
- પસંદ કરેલ પાક: ${cropName}
- જમીનનું માપ: ${landArea}

બનાસકાંઠા અને ગુજરાતની આબોહવા મુજબ આ ખેડૂત માટે વિગતવાર ગણતરી કરીને સરળ ગુજરાતીમાં નીચે મુજબ મુદ્દાસર જવાબ આપો:
1. જમીન અનુકૂળતા અને શક્યતા (આ જમીનમાં આ પાક કેવો થશે?)
2. જરૂરી બિયારણનું ચોક્કસ પ્રમાણ (${landArea} માટે કેટલા કિલો બિયારણ જોઈએ અને બીજ માવજત/પટ)
3. પાયાનું ખાતર (વાવણી સમયે કયું ખાતર અને કેટલું આપવું?)
4. પૂર્તિ ખાતર અને પિયત વ્યવસ્થાપન (પાક વધે ત્યારે શું આપવું?)
5. શરૂઆતથી ધ્યાનમાં રાખવાની મુખ્ય સાવચેતી અને રોગ-જીવાત નિયંત્રણ

ખેડૂત સીધો અમલ કરી શકે તેવી સરળ ભાષામાં સ્પષ્ટ આંકડા સાથે જવાબ આપવો.
`;
    parts = [{ text: promptText }];
  } else {
    // પાક રોગ નિદાન (Image Diagnosis)
    if (!imageBase64) {
      return res.status(400).json({ error: 'કૃપા કરીને પાક કે પાંદડાનો ફોટો આપો.' });
    }
    promptText = `
તમે એક વરિષ્ઠ પાક રોગ નિષ્ણાત છો.
આ પાંદડા કે પાકના ફોટાનું વિશ્લેષણ કરી રોગની ઓળખ કરો.
ખેડૂતની નોંધ: "${query || 'આ પાંદડામાં કયો રોગ છે અને ઉપાય જણાવો'}"

જવાબ માત્ર નીચે મુજબના JSON ફોર્મેટમાં જ આપવો:
{
  "crop_name": "પાકનું નામ",
  "disease_name": "રોગનું સચોટ નામ",
  "severity": "તીવ્રતા (ઓછી / મધ્યમ / ગંભીર)",
  "symptoms": "મુખ્ય લક્ષણો",
  "chemical_treatment": "રાસાયણિક દવા અને પ્રમાણ",
  "organic_treatment": "દેશી અને જૈવિક ઉપાયો",
  "prevention": "સાવચેતીનાં પગલાં"
}
નોંધ: કોઈ પણ વધારાના લખાણ વગર માત્ર શુદ્ધ JSON આપવો.
`;
    parts = [
      { text: promptText },
      {
        inline_data: {
          mime_type: "image/jpeg",
          data: imageBase64
        }
      }
    ];
  }

  const candidateModels = ["gemini-3.5-flash-lite"];
  let finalResult = null;
  let lastError = "";

  for (let model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }] })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
          let text = data.candidates[0].content.parts[0].text.trim();
          if (type === "advisor" || type === "planner") {
            finalResult = { textAnswer: text };
          } else {
            text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            finalResult = JSON.parse(text);
          }
          break;
        } else if (data.error) {
          lastError = data.error.message;
          await wait(2500);
        }
      } catch (err) {
        lastError = err.message;
        await wait(2000);
      }
    }
    if (finalResult) break;
  }

  if (finalResult) {
    return res.status(200).json({ success: true, data: finalResult });
  } else {
    return res.status(500).json({ success: false, error: lastError || "સર્વર વ્યસ્ત છે, કૃપા કરીને થોડીવાર પછી પ્રયાસ કરો." });
  }
}
