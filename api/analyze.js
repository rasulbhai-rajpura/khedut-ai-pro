export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, imageBase64, query, soilType, cropName, landArea, sowingDate, bioOption, bioArea } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'સર્વર પર Gemini API Key ઉપલબ્ધ નથી.' });
  }

  let promptText = "";
  let parts = [];

  if (type === "advisor") {
    promptText = `
તમે એક કૃષિ વૈજ્ઞાનિક અને ખેડૂતના સાચા મિત્ર છો.
ગુજરાત (બનાસકાંઠા, વાવ, થરાદ, ધરણીધર) વિસ્તારના સંદર્ભમાં ખેડૂતના પ્રશ્નનો સરળ ગુજરાતીમાં સચોટ જવાબ આપો:
પ્રશ્ન: "${query}"
`;
    parts = [{ text: promptText }];
  } else if (type === "planner") {
    promptText = `
તમે એક કૃષિ ઉત્પાદન નિષ્ણાત છો.
જમીનનો પ્રકાર: ${soilType}
પાક: ${cropName}
જમીનનું માપ: ${landArea}

બનાસકાંઠા વિસ્તાર મુજબ સરળ ગુજરાતીમાં મુદ્દાસર જવાબ આપો:
1. જમીન અનુકૂળતા
2. જરૂરી બિયારણનું ચોક્કસ પ્રમાણ અને બીજ માવજત/પટ
3. પાયાનું ખાતર (વાવણી સમયે)
4. પૂર્તિ ખાતર અને પિયત
5. રોગ-જીવાત સાવચેતી
`;
    parts = [{ text: promptText }];
  } else if (type === "calendar") {
    promptText = `
તમે એક પાક સમયપત્રક અને કૃષિ આયોજન નિષ્ણાત છો.
પાકનું નામ: ${cropName}
વાવણી તારીખ: ${sowingDate}

બનાસકાંઠા અને ગુજરાતની આબોહવા અનુસાર વાવણી તારીખથી લઈને લણણી સુધીનું વિગતવાર સ્ટેપ-બાય-સ્ટેપ કેલેન્ડર આપો:
1. વાવણી પછી ૦ થી ૧૫ દિવસ: નીંદામણ, પ્રથમ પિયત અને માવજત
2. ૧૫ થી ૩૫ દિવસ: ખાતર વ્યવસ્થાપન અને શરૂઆતની જીવાત નિયંત્રણ
3. ૩૫ થી ૬૦ દિવસ: ફૂલ-બેસણી સમયની ખાસ કાળજી અને છંટકાવ (સ્પ્રે શેડ્યૂલ)
4. ૬૦ થી ૯૦+ દિવસ: દાણા ભરાવવાનો સમય, છેલ્લું પિયત અને લણણી સાવચેતી
સરળ ગુજરાતીમાં મુદ્દાસર સમયપત્રક આપો.
`;
    parts = [{ text: promptText }];
  } else if (type === "bio") {
    promptText = `
તમે પ્રાકૃતિક અને સુભાષ પાલેકર ગાય આધારિત ખેતીના મુખ્ય માર્ગદર્શક છો.
પસંદ કરેલ ઉપાય/ખાતર: ${bioOption}
જમીનનું માપ: ${bioArea}

${bioArea} માટે સરળ અને વ્યવહારુ ગુજરાતીમાં ગણતરી આપો:
1. જરૂરી સામગ્રીનું ચોક્કસ વજન/માપ (દેશી ગાયનું ગોબર, ગૌમૂત્ર, ગોળ, બેસન/કઠોળનો લોટ, વડ નીચેની માટી કે અન્ય વનસ્પતિ)
2. બનાવવાની સ્ટેપ-બાય-સ્ટેપ સરળ રીત
3. વાપરવાનો યોગ્ય સમય અને જમીનમાં આપવાની કે છંટકાવ કરવાની પદ્ધતિ
4. આનાથી પાકને થતા જમીની અને ઉત્પાદનના ફાયદા
`;
    parts = [{ text: promptText }];
  } else {
    // પાક રોગ નિદાન
    if (!imageBase64) {
      return res.status(400).json({ error: 'કૃપા કરીને પાક કે પાંદડાનો ફોટો આપો.' });
    }
    promptText = `
તમે એક વરિષ્ઠ પાક રોગ નિષ્ણાત છો.
આ પાંદડા કે પાકના ફોટાનું વિશ્લેષણ કરી રોગ ઓળખો.
નોંધ: "${query || 'આ પાંદડામાં કયો રોગ છે અને ઉપાય જણાવો'}"

જવાબ માત્ર નીચે મુજબના JSON માં જ આપવો:
{
  "crop_name": "પાકનું નામ",
  "disease_name": "રોગનું સચોટ નામ",
  "severity": "તીવ્રતા (ઓછી / મધ્યમ / ગંભીર)",
  "symptoms": "મુખ્ય લક્ષણો",
  "chemical_treatment": "રાસાયણિક દવા અને પ્રમાણ",
  "organic_treatment": "દેશી અને જૈવિક ઉપાયો",
  "prevention": "સાવચેતીનાં પગલાં"
}
વધારાના કોઈ લખાણ વગર માત્ર શુદ્ધ JSON આપવો.
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

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      let text = data.candidates[0].content.parts[0].text.trim();
      let finalResult = null;
      if (type === "advisor" || type === "planner" || type === "calendar" || type === "bio") {
        finalResult = { textAnswer: text };
      } else {
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        finalResult = JSON.parse(text);
      }
      return res.status(200).json({ success: true, data: finalResult });
    } else if (data.error) {
      return res.status(500).json({ success: false, error: data.error.message });
    } else {
      return res.status(500).json({ success: false, error: "AI તરફથી પ્રતિસાદ મળ્યો નથી." });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

