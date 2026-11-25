async function testNominatimSearch() {
  const url = 'https://nominatim.openstreetmap.org/search?q=barbers+in+Reading,+UK&format=json&addressdetails=1&extratags=1&limit=10';
  console.log('Testing Nominatim Search direct POI query...');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'LeadScoutUK/1.0 (contact@leadscout.co.uk)' },
    signal: AbortSignal.timeout(10000),
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Found results:', data.length);
  if (data.length > 0) {
    console.log('Sample result:', JSON.stringify(data[0], null, 2));
  }
}
testNominatimSearch().catch(console.error);
