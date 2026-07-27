/**
 * Build a printable / shareable doctor QR card PNG (branded), not a bare QR.
 */
export async function downloadDoctorQrCard(options: {
  qrImageUrl: string;
  fullName: string;
  uniqueCode: string;
  specialization?: string | null;
  fileName?: string;
}): Promise<void> {
  const { qrImageUrl, fullName, uniqueCode, specialization } = options;
  const qr = await loadImage(qrImageUrl);

  const W = 760;
  const H = 1020;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas");

  ctx.fillStyle = "#0b1f1c";
  ctx.fillRect(0, 0, W, H);
  drawRadial(ctx, 120, 100, 280, "rgba(45, 212, 191, 0.22)");
  drawRadial(ctx, W - 80, 420, 260, "rgba(16, 185, 129, 0.14)");

  const cardX = 48;
  const cardY = 56;
  const cardW = W - 96;
  const cardH = H - 120;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const headerH = 210;
  roundRect(ctx, cardX, cardY, cardW, headerH, 36);
  ctx.fillStyle = "#0f766e";
  ctx.fill();
  ctx.fillRect(cardX, cardY + headerH - 36, cardW, 36);

  ctx.fillStyle = "rgba(204, 251, 241, 0.92)";
  ctx.font = "700 18px Arial, Helvetica, sans-serif";
  ctx.fillText("BLINKSMED", cardX + 40, cardY + 48);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px Arial, Helvetica, sans-serif";
  ctx.fillText(truncate(ctx, fullName.trim() || "Doctor", cardW - 80), cardX + 40, cardY + 100);

  if (specialization?.trim()) {
    ctx.fillStyle = "rgba(204, 251, 241, 0.9)";
    ctx.font = "500 20px Arial, Helvetica, sans-serif";
    ctx.fillText(truncate(ctx, specialization.trim(), cardW - 80), cardX + 40, cardY + 138);
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 14px Arial, Helvetica, sans-serif";
  ctx.fillText("DOCTOR REFERENCE CARD", cardX + 40, cardY + 178);

  const pillY = cardY + headerH + 36;
  roundRect(ctx, cardX + 40, pillY, cardW - 80, 92, 20);
  ctx.fillStyle = "#f0fdfa";
  ctx.fill();
  ctx.strokeStyle = "#99f6e4";
  ctx.lineWidth = 2;
  roundRect(ctx, cardX + 40, pillY, cardW - 80, 92, 20);
  ctx.stroke();

  ctx.fillStyle = "#0f766e";
  ctx.font = "700 13px Arial, Helvetica, sans-serif";
  ctx.fillText("UNIQUE ID", cardX + 64, pillY + 32);
  ctx.fillStyle = "#134e4a";
  ctx.font = "700 34px Consolas, Monaco, monospace";
  ctx.fillText(uniqueCode, cardX + 64, pillY + 72);

  const qrSize = 340;
  const qrX = Math.round((W - qrSize) / 2);
  const qrY = pillY + 128;
  roundRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  roundRect(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 24);
  ctx.stroke();
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#475569";
  ctx.font = "500 18px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Scan to open doctor profile on BlinksMed", W / 2, qrY + qrSize + 56);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 14px Arial, Helvetica, sans-serif";
  ctx.fillText("Patients use this Unique ID at checkout (optional)", W / 2, qrY + qrSize + 84);

  ctx.fillStyle = "rgba(153, 246, 225, 0.55)";
  ctx.font = "600 13px Arial, Helvetica, sans-serif";
  ctx.fillText("blinksmed · medical equipment rentals", W / 2, H - 28);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to export PNG"))), "image/png");
  });

  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = options.fileName || `doctor-${uniqueCode}-card.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load QR image"));
    img.src = src;
  });
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function drawRadial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
