import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create 512x512 canvas
const size = 512;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Colors
const primaryBlue = '#3B82F6';
const darkBlue = '#1D4ED8';
const lightBlue = '#60A5FA';
const white = '#FFFFFF';

// Clear background (transparent)
ctx.clearRect(0, 0, size, size);

// Helper function to draw rounded rectangle
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Background rounded square
const padding = 40;
const cornerRadius = 80;
roundRect(ctx, padding, padding, size - padding * 2, size - padding * 2, cornerRadius);

// Gradient background
const gradient = ctx.createLinearGradient(padding, padding, size - padding, size - padding);
gradient.addColorStop(0, primaryBlue);
gradient.addColorStop(1, darkBlue);
ctx.fillStyle = gradient;
ctx.fill();

// Draw folder shape (simplified)
const folderX = 100;
const folderY = 140;
const folderW = 200;
const folderH = 160;
const tabW = 70;
const tabH = 30;

ctx.beginPath();
ctx.moveTo(folderX + 20, folderY + tabH);
ctx.lineTo(folderX + 20, folderY + 10);
ctx.quadraticCurveTo(folderX + 20, folderY, folderX + 30, folderY);
ctx.lineTo(folderX + tabW, folderY);
ctx.lineTo(folderX + tabW + 20, folderY + tabH);
ctx.lineTo(folderX + folderW - 10, folderY + tabH);
ctx.quadraticCurveTo(folderX + folderW, folderY + tabH, folderX + folderW, folderY + tabH + 10);
ctx.lineTo(folderX + folderW, folderY + folderH - 10);
ctx.quadraticCurveTo(folderX + folderW, folderY + folderH, folderX + folderW - 10, folderY + folderH);
ctx.lineTo(folderX + 30, folderY + folderH);
ctx.quadraticCurveTo(folderX + 20, folderY + folderH, folderX + 20, folderY + folderH - 10);
ctx.lineTo(folderX + 20, folderY + tabH);
ctx.closePath();
ctx.fillStyle = white;
ctx.globalAlpha = 0.95;
ctx.fill();
ctx.globalAlpha = 1;

// Draw transfer arrows (bidirectional)
const arrowY1 = 340;
const arrowY2 = 390;
const arrowStartX = 130;
const arrowEndX = 380;
const arrowWidth = 12;

// Arrow 1: Left to Right (upload)
ctx.beginPath();
ctx.moveTo(arrowStartX, arrowY1);
ctx.lineTo(arrowEndX - 30, arrowY1);
ctx.lineTo(arrowEndX - 30, arrowY1 - 15);
ctx.lineTo(arrowEndX, arrowY1 + arrowWidth/2);
ctx.lineTo(arrowEndX - 30, arrowY1 + arrowWidth + 15);
ctx.lineTo(arrowEndX - 30, arrowY1 + arrowWidth);
ctx.lineTo(arrowStartX, arrowY1 + arrowWidth);
ctx.closePath();
ctx.fillStyle = lightBlue;
ctx.fill();

// Arrow 2: Right to Left (download)
ctx.beginPath();
ctx.moveTo(arrowEndX, arrowY2);
ctx.lineTo(arrowStartX + 30, arrowY2);
ctx.lineTo(arrowStartX + 30, arrowY2 - 15);
ctx.lineTo(arrowStartX, arrowY2 + arrowWidth/2);
ctx.lineTo(arrowStartX + 30, arrowY2 + arrowWidth + 15);
ctx.lineTo(arrowStartX + 30, arrowY2 + arrowWidth);
ctx.lineTo(arrowEndX, arrowY2 + arrowWidth);
ctx.closePath();
ctx.fillStyle = white;
ctx.globalAlpha = 0.9;
ctx.fill();
ctx.globalAlpha = 1;

// Save to file
const outputPath = path.join(__dirname, '..', 'gui', 'src-tauri', 'icons', 'icon.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);
console.log(`Icon saved to: ${outputPath}`);

// Also save a copy for reference
const refPath = path.join(__dirname, '..', 'icon-512.png');
fs.writeFileSync(refPath, buffer);
console.log(`Reference copy saved to: ${refPath}`);
