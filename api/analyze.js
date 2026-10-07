export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'માત્ર POST મેથડ માન્ય છે.' });

  const { type, query, soilType, cropName, landArea, sowingDate, bioOption, bioArea, imageBase64 } = req.body;
  const groqKey = process.env.GROQ_API_KEY || "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";
  const geminiKey = process.env.GEMINI_API_KEY;

  let prompt = "";

  // ૧. ખેતી સલાહ
  if (type === 'adviser' || type === 'advisor' || type === 'chat' || (!type && query)) {
    prompt = `તમે બનાસકાંઠા (ડીસા, વાવ, થરાદ, પાલનપુર) વિસ્તારના અનુભવી કૃષિ નિષ્ણાત છો.
ખેડૂતનો પ્રશ્ન: "${query}"

સૂચનાઓ:
૧. ખેડૂતના પ્રશ્નનો સીધો, મુદ્દાસર, સાચો અને વ્યવહારુ જવાબ આપો.
૨. જવાબ સરળ અને શુદ્ધ ગુજરાતીમાં આપવો.`;
  } 
  // ૨. જમીન-પાક આયોજન
  else if (type === 'planner') {
    prompt = `જમીનનો પ્રકાર: ${soilType}
વાવેતર કરવાનો પાક: ${cropName}
જમીનનું માપ: ${landArea}
ઉત્તર ગુજરાતના વાતાવરણ મુજબ જરૂરી બિયારણ, પાયાનું ખાતર અને પિયત વ્યવસ્થાપન ગુજરાતીમાં મુદ્દાસર જણાવો.`;
  } 
  // ૩. પાક કેલેન્ડર
  else if (type === 'calendar') {
    prompt = `પાક: ${cropName}
વાવણી તારીખ: ${sowingDate}
વાવણીથી લઈને લણણી સુધીનું તબક્કાવાર ખાતર અને સ્પ્રેનું સમયપત્રક ગુજરાતીમાં સરળ મુદ્દાઓમાં આપો.`;
  } 
  // ૪. પ્રાકૃતિક ખેતી કેલ્ક્યુલેટર
  else if (type === 'bio') {
    prompt = `પ્રાકૃતિક ખેતી ઉપાય: ${bioOption}
વિસ્તાર: ${bioArea}
આ ઉપાય બનાવવા માટે જરૂરી સામગ્રીનું ચોક્કસ માપ અને બનાવવાની રીત ગુજરાતીમાં જણાવો.`;
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

  // Groq API કોલ (બટન ૧ થી ૪ માટે સુપરફાસ્ટ)
  async function callGroq() {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API ભૂલ');
    return data.choices[0].message.content;
  }

  // Gemini API કોલ (બટન ૬ પાક રોગ વિઝન માટે)
  async function callGemini() {
    if (!geminiKey) throw new Error("Gemini API કી ઉપલબ્ધ નથી.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const parts = [{ text: prompt }];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64
        }
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API ભૂલ');
    return data.candidates[0].content.parts[0].text;
  }

  try {
    let rawText = "";

    // ૧ થી ૪ માટે સીધું Groq (જેથી Gemini વાળી એરર ક્યારેય નહીં આવે)
    if (type !== 'disease') {
      rawText = await callGroq();
      return res.status(200).json({ success: true, data: { textAnswer: rawText } });
    }

    // બટન ૬ (પાક રોગ) માટે:
    try {
      rawText = await callGemini();
    } catch (gErr) {
      // જો Gemini કી ન હોય તો Groq દ્વારા જવાબ
      rawText = await callGroq();
    }

    const cleanJson = rawText.replace(/```json|```/g, '').trim();
    return res.status(200).json({ success: true, data: JSON.parse(cleanJson) });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
