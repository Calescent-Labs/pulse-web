// Client-side OG-style PNG renderer for a topic + its 24h velocity arc.
// No backend, no network. Portable: the user downloads a real 1200x630 PNG
// they can attach to a post today. Same visual language as /og-card.png so
// a manual attach and a future dynamic OG look like siblings.

const W = 1200;
const H = 630;

function heatBadgeColor(percentile) {
  if (percentile == null) return "#8a94a6";
  if (percentile >= 0.99) return "#ffe58c";
  if (percentile >= 0.9) return "#ff8c3c";
  if (percentile >= 0.75) return "#dc285a";
  if (percentile >= 0.5) return "#5a28b4";
  return "#8a94a6";
}

function drawGrid(ctx) {
  ctx.fillStyle = "#0e1117";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawArc(ctx, history, box) {
  const values = history.map((h) => (h && typeof h.velocity === "number" ? h.velocity : null));
  const nums = values.filter((v) => v != null);
  if (nums.length < 2) {
    ctx.fillStyle = "#8a94a6";
    ctx.font = "22px 'IBM Plex Mono', monospace";
    ctx.fillText("not enough history for a 24h arc", box.x, box.y + box.h / 2);
    return;
  }
  const ymin = Math.min(...nums, 0);
  const ymax = Math.max(...nums, 0);
  const range = ymax - ymin || 1;
  const step = box.w / (values.length - 1);
  const yFor = (v) => box.y + box.h - ((v - ymin) / range) * box.h;

  // Zero line
  const zeroY = yFor(0);
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x, zeroY);
  ctx.lineTo(box.x + box.w, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Fill under curve
  ctx.beginPath();
  let started = false;
  values.forEach((v, i) => {
    if (v == null) {
      started = false;
      return;
    }
    const x = box.x + i * step;
    const y = yFor(v);
    if (!started) {
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.lineTo(box.x + box.w, zeroY);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 140, 60, 0.15)";
  ctx.fill();

  // Line on top
  ctx.beginPath();
  started = false;
  values.forEach((v, i) => {
    if (v == null) {
      started = false;
      return;
    }
    const x = box.x + i * step;
    const y = yFor(v);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ff8c3c";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "#5a6472";
  ctx.font = "18px 'IBM Plex Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("24h ago", box.x, box.y + box.h + 26);
  ctx.textAlign = "right";
  ctx.fillText("now", box.x + box.w, box.y + box.h + 26);
  ctx.textAlign = "left";
}

function wrap(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Renders the OG-style card to an ImageBitmap-backed canvas and returns
 * a Blob (image/png).
 * @param {{name?:string, sector?:string, heat_percentile?:number, heat_confidence?:number}} topic
 * @param {Array<{velocity?:number|null, bucket_ts?:string}>} history
 * @returns {Promise<Blob>}
 */
export async function renderTopicOgPng(topic, history) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  drawGrid(ctx);

  // Eyebrow
  ctx.fillStyle = "#8a94a6";
  ctx.font = "20px 'IBM Plex Mono', monospace";
  ctx.fillText("PULSE  ·  CALESCENT LABS", 70, 90);

  // Sector chip
  if (topic.sector) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    const chipY = 116;
    ctx.font = "18px 'IBM Plex Mono', monospace";
    const t = topic.sector.toUpperCase();
    const cw = ctx.measureText(t).width + 24;
    ctx.strokeStyle = "#3c4452";
    ctx.lineWidth = 1;
    ctx.strokeRect(70, chipY, cw, 32);
    ctx.fillStyle = "#c8ccd4";
    ctx.fillText(t, 82, chipY + 22);
  }

  // Title (wrap up to 2 lines)
  ctx.fillStyle = "#e6e8ec";
  ctx.font = "700 62px 'IBM Plex Sans', system-ui, sans-serif";
  const titleLines = wrap(ctx, topic.name || "Unnamed topic", W - 160).slice(0, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, 66, 220 + i * 74));

  // Heat badge — big number, small confidence
  const percentile = topic.heat_percentile;
  const conf = topic.heat_confidence;
  const pct = percentile == null ? "—" : `P${Math.round(percentile * 100)}`;
  const confStr = conf == null ? "—" : `${Math.round(conf * 100)}%`;
  ctx.fillStyle = heatBadgeColor(percentile);
  ctx.font = "600 48px 'IBM Plex Mono', monospace";
  ctx.fillText(pct, 70, 370);
  ctx.fillStyle = "#8a94a6";
  ctx.font = "22px 'IBM Plex Mono', monospace";
  const pctW = ctx.measureText(pct).width;
  ctx.fillText(`± ${confStr}`, 80 + pctW, 366);
  ctx.font = "18px 'IBM Plex Mono', monospace";
  ctx.fillText("HEAT PERCENTILE  ·  CONFIDENCE", 70, 400);

  // Arc box
  ctx.font = "18px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#8a94a6";
  ctx.fillText("24H VELOCITY", 70, 450);
  drawArc(ctx, history || [], { x: 70, y: 460, w: W - 140, h: 110 });

  // Attribution
  ctx.fillStyle = "#5a6472";
  ctx.font = "16px 'IBM Plex Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("pulse.calescent  ·  every score ships with its confidence", W - 70, H - 30);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

/** Convenience: trigger a browser download of the rendered PNG. */
export async function downloadTopicOg(topic, history) {
  const blob = await renderTopicOgPng(topic, history);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (topic.name || `topic-${topic.topic_id}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "pulse-topic";
  a.href = url;
  a.download = `pulse-${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
