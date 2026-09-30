const fs = require('fs');

const content = fs.readFileSync('starter/frontend/src/data/dnpLocations.ts', 'utf8');
const match = content.match(/export const DNP_LOCATIONS: DnpRegion\[\] = (\[[\s\S]*?\]);\n\n\/\//);

if (match) {
  const data = eval(match[1]);
  fs.mkdirSync('starter/backend/cmd/seed/data', {recursive: true});
  fs.writeFileSync('starter/backend/cmd/seed/data/dnp_mga_data.json', JSON.stringify(data, null, 2));
  console.log('JSON generated successfully.');
} else {
  console.error('Could not extract array.');
}
