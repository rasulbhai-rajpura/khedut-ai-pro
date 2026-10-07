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
  let isJsonExpected = false;

  // ૧. ખેતી સલાહ
  if (type === 'adviser' || type === 'advisor' || type === 'chat' || (!type && query)) {
    prompt = `તમે બનાસકાંઠા (ડીસા, વાવ, થરાદ, પાલનપુર) વિસ્તારના કૃષિ નિષ્ણાત છો.
ખેડૂતનો પ્રશ્ન: "${query}"

સૂચનાઓ:
૧. ખેડૂતના પ્રશ્નનો સીધો, મુદ્દાસર અને વ્યવહારુ જવાબ આપો.
૨. જવાબ સરળ અને શુદ્ધ ગુજરાતીમાં આપવો.`;
  } 
  // ૨. જમીન-પાક આયોજન
  else if (type === 'planner') {
    prompt = `જમીનનો પ્રકાર: ${soilType}
વાવેતર કરવાનો પાક: ${cropName}
જમીનનું માપ: ${landArea}
ઉત્તર ગુજરાતના હવામાન મુજબ જરૂરી બિયારણ, ખાતર અને પિયત વ્યવસ્થાપન ગુજરાતીમાં મુદ્દાસર જણાવો.`;
  } 
  // ૩. પાક કેલેન્ડર
  else if (type === 'calendar') {
    prompt = `પાક: ${cropName}
વાવણી તારીખ: ${sowingDate}
વાવણીથી લણણી સુધીનું સ્ટેજ મુજબનું ખાતર અને સ્પ્રે સમયપત્રક ગુજરાતીમાં સરળ મુદ્દાઓમાં આપો.`;
  } 
  // ૪. પ્રાકૃતિક ખેતી કેલ્ક્યુલેટર
  else if (type === 'bio') {
    prompt = `પ્રાકૃતિક ખેતી ઉપાય: ${bioOption}
વિસ્તાર: ${bioArea}
આ ઉપાય બનાવવા માટે જરૂરી સામગ્રીનું માપ અને રીત શુદ્ધ ગુજરાતીમાં જણાવો.`;
  } 
  // ૬. પાક રોગ નિદાન
  else if (type === 'disease') {
    isJsonExpected = true;
    prompt = `તમે વનસ્પતિ રોગ વિજ્ઞાનના કૃષિ વૈજ્ઞાનિક છો. આપેલ પાંદડાની છબીનું ઝીણવટભર્યું વિશ્લેષણ કરીને સાચો પાક અને રોગ ઓળખો.
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

  // Gemini API કોલ (v1 સ્ટેબલ વર્ઝન)
  async function callGemini() {
    if (!geminiKey) throw new Error("Gemini API કી નથી.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
    const parts = [{ text: prompt }];

    if (imageBase64 && type === 'disease') {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
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

  // Groq API કોલ (સુપર ફાસ્ટ ટેક્સ્ટ)
  async function callGroq() {
    if (!groqKey) throw new Error("Groq API કી નથી.");
    const userPrompt = (type === 'disease' && query) ? `${prompt}\n(નોંધ: ${query})` : prompt;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq ભૂલ');
    return data.choices[0].message.content;
  }

  try {
    let rawText = "";
    // ટેક્સ્ટ પ્રશ્નો માટે Groq સૌથી ઝડપી જવાબ આપશે
    if (type !== 'disease') {
      try {
        rawText = await callGroq();
      } catch (err) {
        rawText = await callGemini();
      }
    } else {
      // ફોટો હોય ત્યારે Gemini
      try {
        rawText = await callGemini();
      } catch (err) {
        rawText = await callGroq();
      }
    }

    if (isJsonExpected) {
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      return res.status(200).json({ success: true, data: JSON.parse(cleanJson) });
    } else {
      return res.status(200).json({ success: true, data: { textAnswer: rawText } });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
