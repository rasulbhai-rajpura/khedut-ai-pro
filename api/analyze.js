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

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY || "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";
  if (!geminiKey && !groqKey) {
    return res.status(500).json({ success: false, error: 'સર્વર પર API કી સેટ કરેલ નથી.' });
  }

  let prompt = "";
  let isJsonExpected = false;

  // નવો પ્રોમ્પ્ટ:
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
    prompt = `પાક: ${cropName}
વાવણી તારીખ: ${sowingDate}
આ પાક માટે વાવણીથી લઈને લણણી સુધીનું સ્ટેજ મુજબનું સમયપત્રક (ખાતર અને રોગ નિયંત્રણ સ્પ્રે ક્યારે કરવા) ગુજરાતીમાં સરળ મુદ્દાઓમાં આપો.`;
  } 
  // ૪. પ્રાકૃતિક ખેતી કેલ્ક્યુલેટર
  else if (type === 'bio') {
    prompt = `પ્રાકૃતિક ખેતી ઉપાય: ${bioOption}
વિસ્તાર: ${bioArea}
આ ઉપાય બનાવવા માટે જરૂરી સામગ્રીનું ચોક્કસ પ્રમાણ, બનાવવાની સરળ રીત અને ખેતરમાં આપવાની પદ્ધતિ સંપૂર્ણ ગુજરાતીમાં જણાવો.`;
  } 
  // ૫. પાક રોગ નિદાન (Vision)
  else if (type === 'disease') {
    isJsonExpected = true;
    prompt = `તમે પાક રોગ નિષ્ણાત છો. આ છોડના પાનનું નિરીક્ષણ કરો.
વધારાની નોંધ: ${query || "કોઈ નથી"}
તમારે માત્ર નીચે આપેલ JSON ફોર્મેટમાં જ જવાબ આપવાનો છે (કોઈ અન્ય લખાણ નહીં):
{
  "crop_name": "પાકનું નામ (દા.ત. જીરું / કપાસ)",
  "disease_name": "રોગ અથવા જીવાતનું નામ",
  "severity": "હળવો / મધ્યમ / ગંભીર",
  "symptoms": "મુખ્ય લક્ષણો (ગુજરાતીમાં)",
  "chemical_treatment": "અસરકારક રાસાયણિક દવાનું નામ અને માપ (પંપ દીઠ)",
  "organic_treatment": "દેશી/પ્રાકૃતિક ઉપાય",
  "prevention": "ભવિષ્ય માટે સાવચેતી"
}`;
  } else {
    return res.status(400).json({ success: false, error: 'અમાન્ય વિનંતી પ્રકાર.' });
  }

  // Gemini API કોલ
  async function callGemini() {
    const model = "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const parts = [{ text: prompt }];
    if (imageBase64 && type === 'disease') {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
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

  // Groq API બેકઅપ કોલ (Failover)
  async function callGroq() {
    if (!groqKey) throw new Error("Groq API Key ઉપલબ્ધ નથી.");

    const isVision = (imageBase64 && type === 'disease');
    const model = isVision ? "llama-3.2-11b-vision-preview" : "qwen/qwen-2.5-32b-instruct";
    const contentArray = [];
    if (isVision) {
      contentArray.push({ type: "text", text: prompt });
      contentArray.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
      });
    }

    const messages = [
      {
        role: "user",
        content: isVision ? contentArray : prompt
      }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Groq API Error');
    }
    return data.choices[0].message.content;
  }

  // પ્રાઈમરી અને બેકઅપ એક્ઝિક્યુશન
  try {
    let rawText = "";
    try {
      // ૧. પહેલા ગૂગલ જેમિની પ્રયાસ કરશે
      rawText = await callGemini();
    } catch (geminiError) {
      console.warn("Gemini ફેલ થયું, Groq બેકઅપ શરૂ કરી રહ્યું છે:", geminiError.message);
      // ૨. જો જેમિની ફેલ થાય તો Groq બેકઅપ સંભાળશે
      rawText = await callGroq();
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
      error: `બંને સેવાઓ પર ક્ષતિ આવી: ${finalError.message}`
    });
  }
}
