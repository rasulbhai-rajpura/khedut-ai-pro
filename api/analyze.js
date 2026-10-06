// Groq API કોલ (બેકઅપ - હવે વિઝન સપોર્ટ સાથે)
async function callGroq() {
  if (!groqKey) throw new Error("Groq API Key ઉપલબ્ધ નથી.");

  // ⚠️ ઇમેજ સમજવા માટે ફક્ત વિઝન (Vision) વાળું મોડેલ વાપરો
  const model = "llama-3.2-11b-vision-preview"; 
  
  let messages = [];
  const userPrompt = (type === 'disease' && query) ? `${prompt}\n(ખેડૂતની નોંધ: ${query})` : prompt;

  if (imageBase64 && type === 'disease') {
    // જો ઇમેજ હોય તો OpenAI વિઝન ફોર્મેટમાં મોકલો
    const base64Url = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
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
      temperature: 0.3
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Groq API Error');
  return data.choices[0].message.content;
}
