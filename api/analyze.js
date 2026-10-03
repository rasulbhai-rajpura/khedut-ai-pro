export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { 
    type, 
    queryCrop, 
    mandiYard, 
    query, 
    soilType, 
    cropName, 
    landArea, 
    sowingDate, 
    bioOption, 
    bioArea 
  } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY સર્વર પર સેટ નથી.' });
  }

  let prompt = "";
  let isJsonExpected = false;

  // ૧. બજાર ભાવ
  if (type === "live_mandi" || type === "crop_mandi" || type === "mandi") {
    isJsonExpected = true;
    const target = queryCrop || mandiYard || "ગુજરાત માર્કેટ યાર્ડ";
    prompt = `તમે ગુજરાત APMC માર્કેટ યાર્ડના કૃષિ બજાર નિષ્ણાત છો.
લક્ષ્ય: "${target}" માટે ગુજરાતના માર્કેટ યાર્ડના ૨૦ કિલો (૧ મણ) ના વાજબી અને હાલના ચાલુ સરેરાશ બજાર ભાવ આપો.
જો પાક સર્ચ કર્યો હોય તો ગુજરાતના અલગ અલગ મુખ્ય યાર્ડના નામ સાથે ભાવ આપો.
જો યાર્ડ સિલેક્ટ કર્યું હોય તો તે યાર્ડના મુખ્ય પાકોના નામ સાથે ભાવ આપો.

ફક્ત અને ફક્ત નીચે મુજબનો સાચો JSON Array જ આપો:
[
  {"name": "યાર્ડ અથવા પાકનું નામ", "min": 1250, "max": 1580, "trend": "તેજી"},
  {"name": "યાર્ડ અથવા પાકનું નામ", "min": 1100, "max": 1350, "trend": "સ્થિર"}
]`;
  } 
  // ૨. ખેતી સલાહ
  else if (type === "advisor") {
    prompt = `તમે ઉત્તર ગુજરાતના કૃષિ વૈજ્ઞાનિક છો. ખેડૂત મિત્રને સરળ અને શુદ્ધ ગુજરાતીમાં દવા અને ખાતરના ચોક્કસ નામ સાથે માર્ગદર્શન આપો: ${query}`;
  } 
  // ૩. જમીન-પાક આયોજન
  else if (type === "planner") {
    prompt = `જમીનનો પ્રકાર: ${soilType}, પાક: ${cropName}, વિસ્તાર: ${landArea}. બનાસકાંઠા/ઉત્તર ગુજરાતના વાતાવરણ મુજબ બિયારણનો દર અને ખાતર વ્યવસ્થાપન ગુજરાતીમાં વિગતવાર જણાવો.`;
  } 
  // ૪. પાક કેલેન્ડર
  else if (type === "calendar") {
    prompt = `પાક: ${cropName}, વાવણી તારીખ: ${sowingDate}. વાવણીથી લઈને કાપણી સુધીનું તબક્કાવાર છંટકાવ અને પિયત કેલેન્ડર ગુજરાતીમાં આપો.`;
  } 
  // ૫. પ્રાકૃતિક ખેતી
  else if (type === "bio") {
    prompt = `પ્રાકૃતિક ઉપાય: ${bioOption}, જમીનનું માપ: ${bioArea}. આ બનાવવાની રીત, ઘટકોનું પ્રમાણ અને આપવાની પદ્ધતિ ગુજરાતીમાં જણાવો.`;
  } 
  // ૬. પાક રોગ નિદાન
  else if (type === "disease") {
    isJsonExpected = true;
    prompt = `પાક રોગ માટે નીચે મુજબનું શુદ્ધ JSON ફોર્મેટ આપો:
{
  "crop_name": "પાકનું નામ",
  "disease_name": "રોગનું નામ",
  "severity": "સામાન્ય/ગંભીર",
  "symptoms": "લક્ષણો",
  "chemical_treatment": "રાસાયણિક દવા અને માપ",
  "organic_treatment": "દેશી ઉપાય",
  "prevention": "સાવચેતી"
}
વિગત: ${query || 'પાક રોગ'}`;
  }

  try {
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2
      }
    };

    if (isJsonExpected) {
      requestBody.generationConfig.responseMimeType = "application/json";
    }

    // નવી AQ. કી માટે Header માં x-goog-api-key મોકલવી સૌથી સુરક્ષિત રીત છે
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim()
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      let rawText = data.candidates[0].content.parts[0].text.trim();

      if (isJsonExpected) {
        const parsed = JSON.parse(rawText);
        return res.status(200).json({ success: true, data: parsed });
      } else {
        return res.status(200).json({ success: true, data: { textAnswer: rawText } });
      }
    } else {
      const errMsg = data.error?.message || "Gemini તરફથી કોઈ વિગત મળી નથી.";
      return res.status(500).json({ success: false, error: errMsg });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'સર્વર ભૂલ: ' + err.message });
  }
}
