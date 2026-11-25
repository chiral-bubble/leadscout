async function main() {
  const key = process.env.GEMINI_API_KEY || 'AIzaSyCr-czNenJ1x2YQfzOAR85CcEtYZnW8j9M';
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  
  for (const m of models) {
    try {
      console.log(`Testing model ${m} with key ${key.slice(0, 10)}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return valid JSON only: {"status": "ok", "provider": "gemini"}' }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      console.log(`Status for ${m}:`, res.status);
      const text = await res.text();
      console.log(`Body for ${m}:`, text.slice(0, 300));
      if (res.ok) {
        console.log(`SUCCESS! Gemini API works with this key!`);
        return;
      }
    } catch (e: any) {
      console.error(`Error for ${m}:`, e.message);
    }
  }
}
main();
