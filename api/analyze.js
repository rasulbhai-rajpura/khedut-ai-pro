export default async function handler(req, res) {
  // CORS હેડર્સ
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'માત્ર POST મેથડ માન્ય છે.' });

  const { type, query, soilType, cropName, landArea, sowingDate, bioOption, bioArea, imageBase64 } = req.body;

  // 🔑 Gemini (મુખ્ય) અને Groq (બેકઅપ) કીઓ
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = "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";

  let prompt = "";
  let isJsonExpected = false;

  // પ્રોમ્પ્ટ તૈયાર કરો
  if (type === 'adviser' || type === 'advisor' || type === 'chat' || (!type && query)) {
    prompt = `તમે બનાસકાંઠા (ડીસા, વાવ, થરાદ, પાલનપુર) વિસ્તારના અનુભવી કૃષિ નિષ્ણાત છો.\nખેડૂતનો પ્રશ્ન: "${query}"\nસૂચનાઓ: પ્રશ્નનો વિગતવાર જવાબ સરળ ગુજરાતીમાં આપો. પગલાવાર સમજાવો. દવા/ખાતરનું નામ અને પ્રમાણ જણાવો.`;
  } else if (type === 'planner') {
    prompt = `જમીનનો પ્રકાર: ${soilType}\nપાક: ${cropName}\nમાપ: ${landArea}\nઆ પાક માટે બિયારણ, ખાતર અને પિયત વ્યવસ્થાપન વિગતવાર સમજાવો.`;
  } else if (type === 'calendar') {
    prompt = `પાક: ${cropName}\nવાવણી તારીખ: ${sowingDate}\nવાવણીથી લણણી સુધીનું દરેક સપ્તાહનું વિગતવાર સમયપત્રક તૈયાર કરો.`;
  } else if (type === 'bio') {
    prompt = `પ્રાકૃતિક ખેતી ઉપાય: ${bioOption}\nવિસ્તાર: ${bioArea}\nઆ ઉપાયની સામગ્રી, પ્રમાણ, બનાવવાની રીત અને ખેતરમાં આપવાની પદ્ધતિ જણાવો.`;
  } else if (type === 'disease') {
    if (!imageBase64) return res.status(400).json({ success: false, error: 'કૃપા કરીને પહેલા ફોટો અપલોડ કરો.' });
    isJsonExpected = true;
    prompt = `તમે વનસ્પતિ રોગ નિષ્ણાત છો. ફક્ત આ JSON ફોર્મેટમાં ટૂંકમાં જવાબ આપો:\n{"crop_name": "પાક", "disease_name": "રોગ", "severity": "હળવો/મધ્યમ/ગંભીર", "symptoms": "લક્ષણો", "chemical_treatment": "દવા અને પંપ દીઠ માપ", "organic_treatment": "દેશી ઉપાય", "prevention": "સાવચેતી"}`;
  } else {
    return res.status(400).json({ success: false, error: 'અમાન્ય વિનંતી પ્રકાર.' });
  }

  // ==========================================
  // 🟢 Gemini API કોલ (મુખ્ય એન્જિન)
  // ==========================================
  async function callGemini() {
    if (!geminiKey) throw new Error("Gemini API કી ઉપલબ્ધ નથી.");
    
    // ✅ નવી AQ. કી માટે યોગ્ય મોડેલ અને endpoint
    const model = "gemini-1.5-flash-latest"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const parts = [{ text: prompt }];
    if (imageBase64 && type === 'disease') {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] || imageBase64 } });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey // ✅ આ હેડર AQ. કી માટે જરૂરી છે
      },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');
    return data.candidates[0].content.parts[0].text;
  }

  // ==========================================
  // 🟡 Groq API કોલ (બેકઅપ - સુધારેલા મોડેલ સાથે)
  // ==========================================
  async function callGroq() {
    if (!groqKey) throw new Error("Groq API Key ઉપલબ્ધ નથી.");
    
    // ✅ ટેક્સ્ટ માટે સ્થિર મોડેલ, ફોટો માટે વિઝન મોડેલ
    const model = (type === 'disease') ? "qwen/qwen3.8-27b" : "llama-3.1-8b-instant";
    
    let messages = [];
    if (imageBase64 && type === 'disease') {
      const base64Url = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      messages = [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: base64Url } }] }];
    } else {
      messages = [{ role: "user", content: prompt }];
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        model: model, 
        messages: messages, 
        temperature: 0.3,
        max_tokens: (type === 'disease') ? 300 : 800
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API Error');
    return data.choices[0].message.content;
  }

  // ==========================================
  // 🔵 એક્ઝિક્યુશન (પહેલા Gemini, પછી Groq)
  // ==========================================
  try {
    let rawText = "";
    try {
      // Gemini ને મુખ્ય એન્જિન તરીકે ટ્રાય કરો
      rawText = await callGemini(); 
      console.log("✅ Gemini એ સફળતાપૂર્વક જવાબ આપ્યો.");
    } catch (geminiErr) {
      // ❌ જો Gemini ફેલ થાય, તો લોગ્સમાં લખો કે કેમ ફેલ થયું
      console.warn("❌ Gemini ફેલ થયું, કારણ:", geminiErr.message);
      console.warn("⚠️ હવે Groq બેકઅપ વપરાશે...");
      rawText = await callGroq(); 
    }

    if (isJsonExpected) {
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      return res.status(200).json({ success: true, data: JSON.parse(cleanJson) });
    } else {
      return res.status(200).json({ success: true, data: { textAnswer: rawText } });
    }
  } catch (finalError) {
    return res.status(500).json({ success: false, error: `સર્વર ક્ષતિ: ${finalError.message}` });
  }
}
