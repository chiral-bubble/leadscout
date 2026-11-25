async function testNodes() {
  const nodes = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://gall.openstreetmap.de/api/interpreter',
  ];
  const q = '[out:json][timeout:15];node["shop"="hairdresser"](51.44,-0.99,51.47,-0.95);out center tags 5;';
  for (const n of nodes) {
    try {
      console.log('Testing', n);
      const res = await fetch(n, {
        method: 'POST',
        headers: { 'User-Agent': 'LeadScoutUK/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(8000),
      });
      console.log(n, 'status:', res.status);
      if (res.ok) {
        const d = await res.json();
        console.log('Got elements:', d.elements?.length);
      }
    } catch (e: any) {
      console.log(n, 'failed:', e.message);
    }
  }
}
testNodes().catch(console.error);
