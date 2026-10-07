export default async function handler(req, res) {
  // CORS હેડર્સ
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'માત્ર POST મેથડ માન્ય છે.' });
  }

  const { type, query, soilType, cropName, landArea, sowingDate, bioOption, bioArea, imageBase64 } = req.body;

  // ⚠️ સિક્યોરિટી માટે API કી કોડમાં ન લખો, Vercel Environment Variables માં સેટ કરો
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = "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";

  if (!geminiKey && !groqKey) {
    return res.status(500).json({ success: false, error: 'સર્વર પર API કી સેટ કરેલ નથી.' });
  }

  let prompt = "";
  let isJsonExpected = false;

  // ૧. ખેતી સલાહ
  if (type === 'adviser' || type === 'advisor' || type === 'chat' || (!type && query)) {
    prompt = `તમે બનાસકાંઠા (ડીસા, વાવ, થરાદ, પાલનપુર) વિસ્તારના કૃષિ નિષ્ણાત છો.
ખેડૂતનો પ્રશ્ન: "${query}"

સૂચનાઓ:
૧. ખેડૂત જે પ્રશ્ન પૂછે તેનો જ ચોક્કસ, સીધો અને મુદ્દાસર જવાબ આપો.
૨. જો પ્રશ્ન બજાર ભાવ કે સામાન્ય માહિતી અંગે હોય, તો રોગ કે દવા વિશે બિનજરૂરી લખાણ લખવું નહીં. માત્ર અંદાજિત ભાવ અને APMC ની માહિતી આપવી.
૩. જો પ્રશ્ન પાક સંરક્ષણ, રોગ કે જીવાત વિશે હોય, તો જ રોગના કારણ, રાસાયણિક દવા અને દેશી ઉપાય જણાવવા.
૪. જવાબ સરળ અને શુદ્ધ ગુજરાતીમાં આપવો.`;
  } 
  // ૨. જમીન-પાક આયોજન
  else if (type === 'planner') {
    prompt = `જમીનનો પ્રકાર: ${soilType}
વાવેતર કરવાનો પાક: ${cropName}
જમીનનું માપ: ${landArea}
ઉત્તર ગુજરાતના હવામાન મુજબ આ પાક માટે જરૂરી બિયારણનો જથ્થો, પાયાનું ખાતર અને પિયત વ્યવસ્થાપન ગુજરાતીમાં મુદ્દાસર જણાવો.`;
  } 
  // ૩. પાક કેલેન્ડર
  else if (type === 'calendar') {
    prompt = \પાક: ${cropName}\nવાવણી તારીખ: ${sowingDate}\nઆ પાક માટે વાવણીથી લઈને લણણી સુધીનું સ્ટેજ મુજબનું સમયપત્રક ગુજરાતીમાં સરળ મુદ્દાઓમાં આપો.`;`
  } 
  // ૪. પ્રાકૃતિક ખેતી કેલ્ક્યુલેટર
  else if (type === 'bio') {
    prompt = \પ્રાકૃતિક ખેતી ઉપાય: ${bioOption}\nવિસ્તાર: ${bioArea}\nઆ ઉપાય બનાવવા માટે જરૂરી સામગ્રીનું ચોક્કસ પ્રમાણ, બનાવવાની સરળ રીત અને ખેતરમાં આપવાની પદ્ધતિ સંપૂર્ણ ગુજરાતીમાં જણાવો.`;`
  } 
  // ૫. પાક રોગ નિદાન
  else if (type === 'disease') {
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'કૃપા કરીને પહેલા છોડ કે પાંદડાનો ફોટો અપલોડ કરો.' });
    }
    isJsonExpected = true;
    prompt = `તમે વનસ્પતિ રોગ વિજ્ઞાન (Plant Pathology) ના સર્વોચ્ચ નિષ્ણાત કૃષિ વૈજ્ઞાનિક છો.
તમારી સામે ખેડૂતે અપલોડ કરેલી વનસ્પતિની અસલ છબી છે.

સખત સૂચનાઓ:
૧. કોઈ પૂર્વધારણા કે અંદાજ લગાવવો નહીં. 
૨. છબીમાં દેખાતા પાંદડાનો આકાર (પંજા જેવો, સાદો, સંયુક્ત, સોય જેવો), કિનારી, નસોની ગોઠવણી અને રંગનું વનસ્પતિશાસ્ત્ર મુજબ ઝીણવટભર્યું વિશ્લેષણ કરીને તે કયો સાચો પાક છે તે જ ઓળખો.
૩. પાન પર દેખાતી ફૂગ, જીવાત, પીળા-કાળા-કથ્થઈ ડાઘ, સુકારો કે પોષક તત્વોની ખામી ઓળખીને સાચા રોગનું ચોક્કસ નામ આપો.
૪. ગુજરાતની ખેતી પદ્ધતિ મુજબ પ્રમાણિત રાસાયણિક દવા (પંપ દીઠ સાચું માપ) અને દેશી/પ્રાકૃતિક સારવાર સૂચવો.

ફક્ત અને ફક્ત નીચે મુજબના JSON ફોર્મેટમાં જ જવાબ આપો (કોઈ વધારાનું લખાણ નહીં):
{
  "crop_name": "છબી પરથી ઓળખાયેલ સાચો પાક",
  "disease_name": "ચોક્કસ રોગ અથવા જીવાતનું નામ",
  "severity": "હળવો / મધ્યમ / ગંભીર",
  "symptoms": "છબીમાં નરી આંખે દેખાતા ચોક્કસ નુકસાનના લક્ષણો (ગુજરાતીમાં)",
  "chemical_treatment": "અસરકારક રાસાયણિક દવાનું નામ અને ૧૫ લિટર પંપ દીઠ ચોક્કસ માપ",
  "organic_treatment": "અસરકારક દેશી/પ્રાકૃતિક ઉપાય અને બનાવવાની રીત",
  "prevention": "ભવિષ્યમાં આ રોગ ન આવે તે માટે સાવચેતીનાં પગલાં"
}`;
  } else {
    return res.status(400).json({ success: false, error: 'અમાન્ય વિનંતી પ્રકાર.' });
  }

  // ==========================================
  // Gemini API કોલ (મુખ્ય)
  // ==========================================
  async function callGemini() {
    if (!geminiKey) throw new Error("Gemini API કી ઉપલબ્ધ નથી.");
    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const parts = [{ text: prompt }];

    if (imageBase64 && type === 'disease') {
      // Gemini ને 'data:image/jpeg;base64,' વગરનો ફક્ત સાદો કોડ જોઈએ છે
      const base64Data = imageBase64.split(',')[1] || imageBase64;
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API Error');
    }
    return data.candidates[0].content.parts[0].text;
  }

  // ==========================================
  // Groq API કોલ (બેકઅપ - વિઝન સપોર્ટ સાથે) 🛠️ FIXED
  // ==========================================
  async function callGroq() {
    if (!groqKey) throw new Error("Groq API Key ઉપલબ્ધ નથી.");

    // ⚠️ ઇમેજ સમજવા માટે ફક્ત વિઝન (Vision) વાળું મોડેલ વાપરવું પડે
    const model = "qwen/qwen3.8-27b";
    const userPrompt = (type === 'disease' && query) 
      ? `${prompt}\n(ખેડૂતની નોંધ: ${query})` 
      : prompt;

    let messages = [];

    if (imageBase64 && type === 'disease') {
      // Groq ને 'data:image/jpeg;base64,' સાથેની આખી લિંક જોઈએ છે
      const base64Url = imageBase64.startsWith('data:') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`;
        
      messages = [{
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: base64Url } }
        ]
      }];
    } else {
      messages = [{ role: "user", content: userPrompt }];
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
  model: model,
  messages: messages,
  temperature: 0.3,
  max_tokens: 500 // 🛠️ આ લાઈન ઉમેરો (લિમિટ પાર ન થાય તે માટે)
})
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Groq API Error');
    }
    return data.choices[0].message.content;
  }

  // ==========================================
  // એક્ઝિક્યુશન (Execution Logic)
  // ==========================================
  try {
    let rawText = "";
    try {
      rawText = await callGemini(); // પહેલા Gemini ટ્રાય કરો
    } catch (geminiErr) {
      console.warn("Gemini ફેલ થયું, Groq બેકઅપ શરૂ:", geminiErr.message);
      rawText = await callGroq(); // Gemini ફેલ થાય તો Groq વાપરો
    }

    if (isJsonExpected) {
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      return res.status(200).json({ success: true, data: parsedData });
    } else {
      return res.status(200).json({ success: true, data: { textAnswer: rawText } });
    }
  } catch (finalError) {
    return res.status(500).json({
      success: false,
      error: `સર્વર ક્ષતિ: ${finalError.message}`
    });
  }
}
