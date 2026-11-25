async function testOsm() {
  // 1. Geocode "Reading, UK" with Nominatim
  const loc = 'Reading, UK';
  console.log(`Geocoding "${loc}" with Nominatim...`);
  const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc)}&limit=1`;
  const geoRes = await fetch(geoUrl, {
    headers: { 'User-Agent': 'LeadScoutUK/1.0 (contact@leadscout.co.uk)' },
  });
  const geoData = await geoRes.json();
  if (!geoData || geoData.length === 0) {
    throw new Error('Geocoding failed for Reading, UK');
  }
  const { lat, lon, display_name } = geoData[0];
  console.log(`Geocoded to: ${display_name} (${lat}, ${lon})`);

  // 2. Query Overpass API for barbers within 5 miles (~8000m)
  const radius = 8000;
  console.log(`Querying Overpass API for barbers within ${radius}m...`);
  const overpassQuery = `
[out:json][timeout:25];
(
  node["shop"="hairdresser"](around:${radius},${lat},${lon});
  way["shop"="hairdresser"](around:${radius},${lat},${lon});
  node["shop"="barber"](around:${radius},${lat},${lon});
  way["shop"="barber"](around:${radius},${lat},${lon});
  node["amenity"="barber"](around:${radius},${lat},${lon});
);
out center tags 30;
`;

  const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'User-Agent': 'LeadScoutUK/1.0 (contact@leadscout.co.uk)',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'data=' + encodeURIComponent(overpassQuery),
  });

  console.log('Overpass HTTP status:', overpassRes.status);
  const data = await overpassRes.json();
  console.log(`Found ${data.elements?.length || 0} OSM elements!`);

  const results = (data.elements || [])
    .filter((e: any) => e.tags && e.tags.name)
    .map((e: any) => {
      const t = e.tags;
      const street = t['addr:street'] || t['addr:housename'] || '';
      const num = t['addr:housenumber'] || '';
      const city = t['addr:city'] || t['addr:town'] || 'Reading';
      const postcode = t['addr:postcode'] || '';
      const address = [num, street, city, postcode].filter(Boolean).join(', ') || 'Reading, UK';
      const phone = t.phone || t['contact:phone'] || null;
      const website = t.website || t['contact:website'] || null;

      return {
        id: `osm-${e.type}-${e.id}`,
        name: t.name,
        address,
        postcode: postcode || null,
        phone,
        website,
        has_website: Boolean(website),
        opening_hours: t.opening_hours || null,
        tags: Object.keys(t).filter((k) => k.startsWith('shop') || k.startsWith('amenity')),
      };
    });

  console.log(`\nFiltered to ${results.length} named barber businesses in Reading:`);
  results.slice(0, 10).forEach((b: any, i: number) => {
    console.log(`${i + 1}. ${b.name}`);
    console.log(`   Address: ${b.address}`);
    console.log(`   Phone: ${b.phone || 'None'}`);
    console.log(`   Website: ${b.website || 'No website tag'}`);
    console.log(`   Opening hours: ${b.opening_hours || 'Not specified'}`);
  });
}

testOsm().catch(console.error);
