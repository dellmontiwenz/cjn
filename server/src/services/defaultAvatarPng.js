import { createCanvas } from '@napi-rs/canvas';

let cachedAvatarPng = null;

export function getDefaultAvatarPng() {
  if (cachedAvatarPng) {
    return cachedAvatarPng;
  }

  const canvas = createCanvas(160, 160);
  const context = canvas.getContext('2d');

  context.fillStyle = '#e5e7eb';
  context.fillRect(0, 0, 160, 160);

  context.fillStyle = '#9ca3af';
  context.beginPath();
  context.arc(80, 62, 30, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.arc(80, 150, 50, Math.PI, 0);
  context.fill();

  cachedAvatarPng = canvas.toBuffer('image/png');
  return cachedAvatarPng;
}
