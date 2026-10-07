export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'માત્ર POST માન્ય છે.' });

  const { type, query, soilType, cropName, landArea, sowingDate, bioOption, bioArea, imageBase64 } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  let prompt = "";

  // ૧. ખેતી સલાહ
  if (type === 'adviser' || type === 'advisor' || type === 'chat' || (!type && query)) {
    prompt = `તમે બનાસકાંઠા (ડીસા, વાવ, થરાદ, પાલનપુર) વિસ્તારના કૃષિ નિષ્ણાત છો.
ખેડૂતનો પ્રશ્ન: "${query}"
સૂચના: પ્રશ્નનો સ્પષ્ટ, મુદ્દાસર અને વ્યવહારુ જવાબ સરળ ગુજરાતીમાં આપો.`;
  } 
  // ૨. જમીન-પાક આયોજન
  else if (type === 'planner') {
    prompt = `જમીન: ${soilType}, પાક: ${cropName}, વિસ્તાર: ${landArea}.
ઉત્તર ગુજરાતના વાતાવરણ મુજબ બિયારણ, ખાતર અને પિયત વ્યવસ્થાપન ગુજરાતીમાં મુદ્દાસર જણાવો.`;
  } 
  // ૩. પાક કેલેન્ડર
  else if (type === 'calendar') {
    prompt = `પાક: ${cropName}, વાવણી તારીખ: ${sowingDate}.
વાવણીથી લણણી સુધીનું તબક્કાવાર ખાતર અને સ્પ્રે સમયપત્રક ગુજરાતીમાં આપો.`;
  } 
  // ૪. પ્રાકૃતિક ખેતી કેલ્ક્યુલેટર
  else if (type === 'bio') {
    prompt = `ઉપાય: ${bioOption}, વિસ્તાર: ${bioArea}.
આ બનાવવા માટે જરૂરી સામગ્રી અને બનાવવાની પદ્ધતિ ગુજરાતીમાં જણાવો.`;
  } 
  // ૬. પાક રોગ નિદાન
  else if (type === 'disease') {
    prompt = `તમે વનસ્પતિ રોગ વિજ્ઞાનના કૃષિ વૈજ્ઞાનિક છો. આપેલ પાંદડાની છબીનું વિશ્લેષણ કરીને સાચો પાક અને રોગ ઓળખો.
ફક્ત નીચે મુજબના JSON ફોર્મેટમાં જ જવાબ આપો:
{
  "crop_name": "ઓળખાયેલ પાકનું નામ",
  "disease_name": "રોગ અથવા જીવાતનું નામ",
  "severity": "હળવો / મધ્યમ / ગંભીર",
  "symptoms": "નુકસાનના લક્ષણો ગુજરાતીમાં",
  "chemical_treatment": "રાસાયણિક દવા અને ૧૫ લિટર પંપ દીઠ માપ",
  "organic_treatment": "દેશી/પ્રાકૃતિક ઉપાય",
  "prevention": "સાવચેતીનાં પગલાં"
}`;
  } else {
    return res.status(400).json({ success: false, error: 'અમાન્ય વિનંતી.' });
  }

  try {
    const model = "gemini-3.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    const parts = [{ text: prompt }];

    if (imageBase64 && type === 'disease') {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64
        }
      });
    }

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    let data = await response.json();

    // હાઈ ડિમાન્ડ વખતે આપોઆપ ૧.૫ સેકન્ડ પછી પુનઃપ્રયાસ
    if (!response.ok && data.error?.message?.includes('high demand')) {
      await new Promise(r => setTimeout(r, 1500));
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });
      data = await response.json();
    }

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API ભૂલ');
    }

    const rawText = data.candidates[0].content.parts[0].text;

    if (type === 'disease') {
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      return res.status(200).json({ success: true, data: JSON.parse(cleanJson) });
    } else {
      return res.status(200).json({ success: true, data: { textAnswer: rawText } });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}


