import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pngPath = path.join(__dirname, '..', 'gui', 'src-tauri', 'icons', 'icon.png');
const icoPath = path.join(__dirname, '..', 'gui', 'src-tauri', 'icons', 'icon.ico');

const pngBuffer = fs.readFileSync(pngPath);

pngToIco(pngBuffer)
  .then(ico => {
    fs.writeFileSync(icoPath, ico);
    console.log(`ICO saved to: ${icoPath}`);
  })
  .catch(err => {
    console.error('Error converting to ICO:', err);
  });
