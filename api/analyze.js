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

  // 🔑 Gemini અને Groq ની API કીઓ
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = "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";

  if (!geminiKey && !groqKey) {
    return res.status(500).json({ success: false, error: 'સર્વર પર API કી સેટ કરેલ નથી.' });
  }

  let prompt = "";
  let isJsonExpected = false;

  // ૧. ખેતી સલાહ
  if (type === 'adviser' || type === 'advisor' || type === 'chat' || (!type && query)) {
    prompt = `તમે બનાસકાંઠા (ડીસા, વાવ, થરાદ, પાલનપુર) વિસ્તારના અનુભવી કૃષિ નિષ્ણાત છો. તમારે ખેડૂતને એવી રીતે સમજાવવાનું છે જે તે સહેલાઈથી સમજી શકે.
ખેડૂતનો પ્રશ્ન: "${query}"

સૂચનાઓ:
૧. પ્રશ્નનો સંપૂર્ણ, વિગતવાર અને સચોટ જવાબ સરળ ગુજરાતી ભાષામાં આપો.
૨. જવાબમાં ખેડૂતને શું કરવું, ક્યારે કરવું અને કેવી રીતે કરવું તે પગલાવાર (Step-by-step) સમજાવો.
૩. જો દવા કે ખાતરની સલાહ હોય, તો તેનું ચોક્કસ નામ અને પ્રમાણ (૧૫ લિટર પંપ દીઠ) જણાવો.
૪. જવાબ લંબાણથી, સમજાય તેવી રીતે અને જરૂરી મુદ્દાઓ સાથે આપો. ટૂંકમાં ન આપો.
૫. અંતે એક નાની ટીપ પણ આપો જેથી ખેડૂતને વધુ ફાયદો થાય.`;
  } 
  // ૨. જમીન-પાક આયોજન
  else if (type === 'planner') {
    prompt = `તમે અનુભવી કૃષિ નિષ્ણાત છો. નીચેની વિગતો મુજબ ખેડૂતને સંપૂર્ણ માર્ગદર્શન આપો.
જમીનનો પ્રકાર: ${soilType}
વાવેતર કરવાનો પાક: ${cropName}
જમીનનું માપ: ${landArea}

સૂચનાઓ:
૧. આ પાક માટે કઈ જાત (Variety) સારી છે તે જણાવો.
૨. જરૂરી બિયારણનો જથ્થો, બીજની સારવાર અને વાવેતરની યોગ્ય રીત સમજાવો.
૩. પાયાનું ખાતર, ઉપરનું ખાતર અને સૂક્ષ્મ પોષક તત્વોની વિગત આપો.
૪. પિયત વ્યવસ્થાપન અને આખા પાક દરમિયાન કરવાની મુખ્ય કામગીરી પગલાવાર જણાવો.
૫. જવાબ વિગતવાર અને ખેડૂતને સમજાય તેવી સરળ ભાષામાં આપો.`;
  } 
  // ૩. પાક કેલેન્ડર
  else if (type === 'calendar') {
    prompt = `તમે અનુભવી કૃષિ નિષ્ણાત છો.
પાક: ${cropName}
વાવણી તારીખ: ${sowingDate}

સૂચનાઓ:
૧. વાવણીથી લઈને લણણી સુધીના દરેક સપ્તાહ (અઠવાડિયું) નું વિગતવાર સમયપત્રક તૈયાર કરો.
૨. કયા દિવસે કયું ખાતર, કઈ દવા કે કઈ કામગીરી કરવી તે કોષ્ટક (Table) સ્વરૂપે સમજાવો.
૩. દરેક તબક્કે ખેડૂતે શું ધ્યાન રાખવું તે પણ જણાવો.
૪. જવાબ સંપૂર્ણ વિગતવાર અને સરળ ગુજરાતીમાં આપો.`;
  } 
  // ૪. પ્રાકૃતિક ખેતી કેલ્ક્યુલેટર
  else if (type === 'bio') {
    prompt = `તમે પ્રાકૃતિક ખેતીના નિષ્ણાત છો.
ઉપાય: ${bioOption}
વિસ્તાર: ${bioArea}

સૂચનાઓ:
૧. આ ઉપાય બનાવવા માટે જરૂરી સામગ્રીની સંપૂર્ણ યાદી અને ચોક્કસ પ્રમાણ આપો.
૨. બનાવવાની રીત પગલાવાર (Step-by-step) વિગતવાર સમજાવો.
૩. કેટલા દિવસમાં તૈયાર થાય, કેવી રીતે સંગ્રહ કરવો અને કેટલા સમય સુધી વાપરી શકાય તે જણાવો.
૪. ખેતરમાં આપવાની ચોક્કસ પદ્ધતિ અને સમય જણાવો.
૫. આ ઉપાયથી થતા ફાયદા અને સાવચેતીની બાબતો પણ સમજાવો.
૬. જવાબ સંપૂર્ણ વિગતવાર અને સરળ ગુજરાતીમાં આપો.`;
  } 
  // ૫. પાક રોગ નિદાન
  else if (type === 'disease') {
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'કૃપા કરીને પહેલા છોડ કે પાંદડાનો ફોટો અપલોડ કરો.' });
    }
    isJsonExpected = true;
    prompt = `તમે વનસ્પતિ રોગ વિજ્ઞાનના નિષ્ણાત છો. સામે અપલોડ કરેલી છબી છે.
સૂચનાઓ:
૧. છબીમાંથી પાક ઓળખો અને રોગ/જીવાતનું ચોક્કસ નામ આપો.
૨. રોગના લક્ષણો વિગતવાર સમજાવો.
૩. ગુજરાતની ખેતી મુજબ રાસાયણિક દવા (૧૫ લિટર પંપ દીઠ ચોક્કસ માપ) અને દેશી/પ્રાકૃતિક સારવાર સૂચવો.
૪. ભવિષ્યમાં આ રોગ ન આવે તે માટે સાવચેતીનાં પગલાં જણાવો.
ફક્ત આ JSON ફોર્મેટમાં જ જવાબ આપો:
{
  "crop_name": "સાચો પાક",
  "disease_name": "રોગનું નામ",
  "severity": "હળવો / મધ્યમ / ગંભીર",
  "symptoms": "લક્ષણો (ગુજરાતીમાં)",
  "chemical_treatment": "દવા અને ૧૫ લિટર પંપ દીઠ માપ",
  "organic_treatment": "દેશી ઉપાય અને બનાવવાની રીત",
  "prevention": "સાવચેતીનાં પગલાં"
}`;
  } else {
    return res.status(400).json({ success: false, error: 'અમાન્ય વિનંતી પ્રકાર.' });
  }

  // ==========================================
  // Gemini API કોલ (મુખ્ય) 🛠️ FIXED for AQ. Key
  // ==========================================
  async function callGemini() {
    if (!geminiKey) throw new Error("Gemini API કી ઉપલબ્ધ નથી.");
    const model = "gemini-2.0-flash";
    
    // 🛠️ URL માંથી ?key= કાઢી નાખ્યું છે
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const parts = [{ text: prompt }];

    if (imageBase64 && type === 'disease') {
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
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey // ✅ નવી AQ. કી માટે આ હેડર જરૂરી છે
      },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API Error');
    }
    return data.candidates[0].content.parts[0].text;
  }

  // ==========================================
  // Groq API કોલ (બેકઅપ)
  // ==========================================
  async function callGroq() {
    if (!groqKey) throw new Error("Groq API Key ઉપલબ્ધ નથી.");

    // ટેક્સ્ટ માટે ઝડપી મોડેલ, ફોટો માટે વિઝન મોડેલ
    const model = (type === 'disease') ? "qwen/qwen3.8-27b" : "llama-3.1-8b-instant";
    
    const userPrompt = (type === 'disease' && query) 
      ? `${prompt}\n(ખેડૂતની નોંધ: ${query})` 
      : prompt;

    let messages = [];

    if (imageBase64 && type === 'disease') {
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
        temperature: 0.5
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
