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

  // 🔑 અહીં તમારી Groq API કી પેસ્ટ કરો (જૂની બ્લોક થઈ ગઈ હોય તો નવી બનાવો)
  const groqKey = "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";

  if (!groqKey) {
    return res.status(500).json({ success: false, error: 'સર્વર પર Groq API કી સેટ કરેલ નથી.' });
  }

  let prompt = "";
  let isJsonExpected = false;

  // ૧. ખેતી સલાહ
  if (type === 'adviser' || type === 'advisor' || type === 'chat' || (!type && query)) {
    prompt = `તમે બનાસકાંઠા (ડીસા, વાવ, થરાદ, પાલનપુર) વિસ્તારના કૃષિ નિષ્ણાત છો.
ખેડૂતનો પ્રશ્ન: "${query}"
સૂચનાઓ:
૧. ખેડૂત જે પ્રશ્ન પૂછે તેનો જ ચોક્કસ, સીધો અને મુદ્દાસર જવાબ આપો.
૨. જવાબ સરળ અને શુદ્ધ ગુજરાતીમાં આપવો.`;
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
    // ✅ સુધારો: બેકટિક (``) વાપર્યા છે
    prompt = `પાક: ${cropName}\nવાવણી તારીખ: ${sowingDate}\nઆ પાક માટે વાવણીથી લઈને લણણી સુધીનું સ્ટેજ મુજબનું સમયપત્રક ખેડૂતને સમજાય તેવી સરળ ગુજરાતી ભાષામાં, કોષ્ટક (Table) સ્વરૂપે વિગતવાર જણાવો.`;
  } 
  // ૪. પ્રાકૃતિક ખેતી કેલ્ક્યુલેટર
  else if (type === 'bio') {
    // ✅ સુધારો: બેકટિક (``) વાપર્યા છે
    prompt = `પ્રાકૃતિક ખેતી ઉપાય: ${bioOption}\nવિસ્તાર: ${bioArea}\nઆ ઉપાય બનાવવા માટે જરૂરી સામગ્રીનું ચોક્કસ પ્રમાણ, બનાવવાની સરળ રીત અને ખેતરમાં આપવાની પદ્ધતિ ખેડૂતને સમજાય તેવી સરળ ગુજરાતી ભાષામાં પગલાવાર (Step-by-step) વિગતવાર સમજાવો.`;
  } 
  // ૫. પાક રોગ નિદાન
  else if (type === 'disease') {
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'કૃપા કરીને પહેલા છોડ કે પાંદડાનો ફોટો અપલોડ કરો.' });
    }
    isJsonExpected = true;
    prompt = `તમે વનસ્પતિ રોગ વિજ્ઞાનના નિષ્ણાત છો. સામે અપલોડ કરેલી છબી છે.
સૂચનાઓ:
૧. છબીમાંથી પાક ઓળખો અને રોગ/જીવાતનું નામ આપો.
૨. ગુજરાતની ખેતી મુજબ રાસાયણિક દવા (૧૫ લિટર પંપ દીઠ માપ) અને દેશી સારવાર સૂચવો.
ફક્ત આ JSON ફોર્મેટમાં જવાબ આપો:
{
  "crop_name": "સાચો પાક",
  "disease_name": "રોગનું નામ",
  "severity": "હળવો / મધ્યમ / ગંભીર",
  "symptoms": "લક્ષણો (ગુજરાતીમાં)",
  "chemical_treatment": "દવા અને પંપ દીઠ માપ",
  "organic_treatment": "દેશી ઉપાય",
  "prevention": "સાવચેતી"
}`;
  } else {
    return res.status(400).json({ success: false, error: 'અમાન્ય વિનંતી પ્રકાર.' });
  }

  // ==========================================
  // Groq API કોલ (મુખ્ય અને એકમાત્ર)
  // ==========================================
  async function callGroq() {
    const model = "qwen/qwen3.8-27b";
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
        temperature: 0.3,
        max_tokens: 1500 // 🛠️ લિમિટ પાર ન થાય તે માટે
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
    let rawText = await callGroq();

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
