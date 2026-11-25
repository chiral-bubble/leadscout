async function testDresel() {
  const url = 'https://ovp.dresel.systems/api/interpreter';
  const q = `
[out:json][timeout:20];
(
  node["shop"="hairdresser"](around:8000,51.456,-0.970);
  node["shop"="barber"](around:8000,51.456,-0.970);
  way["shop"="hairdresser"](around:8000,51.456,-0.970);
  way["shop"="barber"](around:8000,51.456,-0.970);
);
out center tags 20;
`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'LeadScoutUK/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q),
      signal: AbortSignal.timeout(15000),
    });
    console.log('Dresel status:', res.status);
    if (res.ok) {
      const d = await res.json();
      console.log('Dresel elements count:', d.elements?.length);
      d.elements.slice(0, 5).forEach((e: any, idx: number) => {
        console.log(`${idx + 1}. ${e.tags?.name || 'Unnamed'} (${e.tags?.website || 'No website'})`);
      });
    }
  } catch (e: any) {
    console.log('Dresel failed:', e.message);
  }
}
testDresel();
