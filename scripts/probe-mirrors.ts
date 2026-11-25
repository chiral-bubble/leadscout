async function probe() {
  const mirrors = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];
  const q = '[out:json][timeout:15];node["shop"="barber"](around:2000,51.456,-0.971);out center tags 5;';
  for (const m of mirrors) {
    try {
      const t0 = Date.now();
      const res = await fetch(m, {
        method: 'POST',
        headers: { 'User-Agent': 'LeadScoutUK/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(m, 'SUCCESS in', Date.now() - t0, 'ms. Elements:', data.elements?.length);
      } else {
        console.log(m, 'HTTP', res.status);
      }
    } catch (e: any) {
      console.log(m, 'FAILED:', e.message);
    }
  }
}
probe();
