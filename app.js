/* ============================================================
 * 圣诞夜 · 粒子圣诞树
 * 原生 Canvas 2D：深冬夜空、飘雪、粒子树、粒子灯带、雪花开场
 * ============================================================ */

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1;

/* ---------- 预设配色（只改变树体，背景固定深冬色） ---------- */
const PALETTES = {
  ice: {
    tree: ['#eaf6ff', '#bcd9ff', '#8fb8ff'],
    ribbon: '#dfeeff', star: '#fff7d6', ball: '#ffd98a'
  },
  goldred: {
    tree: ['#ffe9c2', '#ffc873', '#e89a52'],
    ribbon: '#ffd98a', star: '#fff3c4', ball: '#bcd9ff'
  },
  green: {
    tree: ['#dff3d8', '#7fc98a', '#2f7d55'],
    ribbon: '#ffd98a', star: '#fff3c4', ball: '#ffd98a'
  },
  violet: {
    tree: ['#f1e4ff', '#c9a6ff', '#8a6fd8'],
    ribbon: '#e6ccff', star: '#fff3c4', ball: '#ffe0a3'
  },
  pink: {
    tree: ['#ffe3f0', '#ffb7d9', '#ff7eb6'],
    ribbon: '#ffd6e8', star: '#fff3c4', ball: '#c8f5e0'
  },
  mint: {
    tree: ['#e2f8ec', '#c8f5e0', '#5fd9a8'],
    ribbon: '#d6f5e6', star: '#fff3c4', ball: '#ffb7d9'
  }
};

/* 固定深冬夜空底色 */
const BG_TOP = '#0a1526';
const BG_BOTTOM = '#040810';

/* ---------- 全局状态 ---------- */
const state = {
  phase: 'snowflake',        // snowflake → snowburst → gather → settle → tree
  phaseStart: performance.now(),
  snowAmount: 0.55,
  palette: 'ice',
  customColor: '#ffd166',
  mainText: 'Merry Christmas',
  subText: '愿你平安喜乐',
  greetingSize: 54
};

const G = { cx: 0, topY: 0, baseY: 0, treeH: 0, R: 0 };
const TREE_PARTICLES = [];
const RIBBON_PARTICLES = [];
const STAR_PARTICLES = [];
const ORNAMENTS = [];
const GROUND_PARTICLES = [];
let snowFlakes = [];
let bokeh = [];
let villageLights = [];
let shards = [];
let fireworks = [];
let lastFirework = 0;
const mouse = { x: -9999, y: -9999 };
const hoverAnim = { t: 0 };

const panelEl = document.getElementById('panel');
const greetingEl = document.getElementById('greeting');

const MAX_SNOW = 180;

/* ---------- 颜色工具 ---------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function parseColor(c) {
  c = c.trim();
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const m = c.match(/\d+/g);
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

function mixColor(a, b, f) {
  const A = parseColor(a), B = parseColor(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * f)},${Math.round(A[1] + (B[1] - A[1]) * f)},${Math.round(A[2] + (B[2] - A[2]) * f)})`;
}

function rgbaOf(c, a) {
  const v = parseColor(c);
  return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
}

/* 树体自上而下三段颜色平滑过渡，不再硬切 */
function treeColor(pal, u) {
  const s = pal.tree;
  const t = Math.min(1, Math.max(0, u)) * 2;
  const i = Math.min(1, Math.floor(t));
  return mixColor(s[i], s[i + 1], t - i);
}

function currentPalette() {
  if (state.palette === 'custom') {
    const base = state.customColor;
    return {
      tree: [shade(base, 45), base, shade(base, -25)],
      ribbon: shade(base, 35),
      star: '#fff3c4',
      ball: shade(base, -30)
    };
  }
  return PALETTES[state.palette];
}

/* ---------- 几何布局（树位于左侧面板右侧的合适区域，不居正中） ---------- */
function layout() {
  const panelW = W < 768 ? 230 : 280;
  const areaLeft = panelW;
  const areaRight = W;
  const areaW = Math.max(areaRight - areaLeft, 200);
  G.cx = areaLeft + areaW * 0.52;
  G.treeH = H * 0.6;
  G.baseY = H * 0.8;
  G.topY = G.baseY - G.treeH;
  G.R = Math.min(areaW * 0.26, G.treeH * 0.42);
  TREE_PARTICLES.forEach(p => {
    const pos = targetPos(p);
    p.tx = pos.x; p.ty = pos.y;
  });
  RIBBON_PARTICLES.forEach(p => {
    const pos = ribbonPos(p);
    p.tx = pos.x; p.ty = pos.y;
  });
  ORNAMENTS.forEach(p => {
    const pos = ornamentPos(p);
    p.tx = pos.x; p.ty = pos.y;
  });
  GROUND_PARTICLES.forEach(p => {
    const pos = groundPos(p);
    p.tx = pos.x; p.ty = pos.y;
  });
  greetingEl.style.left = G.cx + 'px';
  greetingEl.style.bottom = '8%';
}

function ornamentPos(p) {
  const rad = G.R * p.u * (1.02 + 0.08 * p.rOff);
  return {
    x: G.cx + rad * Math.cos(p.theta),
    y: G.topY + p.u * G.treeH
  };
}

function groundPos(p) {
  const rad = G.R * p.dist;
  return {
    x: G.cx + rad * Math.cos(p.theta) * 1.75,
    y: G.baseY + rad * Math.sin(p.theta) * 0.16 + p.jitter
  };
}

function targetPos(p) {
  const rad = G.R * p.u * (0.55 + 0.45 * p.rOff);
  return {
    x: G.cx + rad * Math.cos(p.theta),
    y: G.topY + p.u * G.treeH
  };
}

function ribbonPos(p) {
  const ang = p.theta0 + p.u * 2.4 * Math.PI * 2;
  const rad = G.R * p.u * 0.99;
  return {
    x: G.cx + rad * Math.cos(ang),
    y: G.topY + p.u * G.treeH
  };
}

/* ---------- 粒子树构建（加密，下部加厚） ---------- */
function buildTree() {
  TREE_PARTICLES.length = 0;
  const n = Math.max(600, Math.min(1500, Math.floor(W * H / 800)));
  for (let i = 0; i < n; i++) {
    TREE_PARTICLES.push({
      u: Math.pow(Math.random(), 0.72),
      theta: Math.random() * Math.PI * 2,
      rOff: 0.5 + 0.5 * Math.random(),
      size: 0.8 + Math.random() * 1.8,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 0.6 + Math.random() * 1.6,
      tx: 0, ty: 0, sx: 0, sy: 0, sa: 0
    });
  }
  // 底部加厚粒子
  const base = 200;
  for (let i = 0; i < base; i++) {
    TREE_PARTICLES.push({
      u: 0.82 + Math.random() * 0.18,
      theta: Math.random() * Math.PI * 2,
      rOff: 0.7 + 0.3 * Math.random(),
      size: 0.9 + Math.random() * 1.8,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 0.6 + Math.random() * 1.6,
      tx: 0, ty: 0, sx: 0, sy: 0, sa: 0
    });
  }
  layout();
}

/* ---------- 粒子灯带（螺旋环绕，与树同材质光点） ---------- */
function buildRibbons() {
  RIBBON_PARTICLES.length = 0;
  const ribbons = 3, per = 70;
  for (let ri = 0; ri < ribbons; ri++) {
    for (let k = 0; k <= per; k++) {
      const u = k / per;
      RIBBON_PARTICLES.push({
        u: u,
        theta0: ri * Math.PI * 2 / ribbons,
        size: 1.2 + Math.random() * 1.0,
        tw: Math.random() * Math.PI * 2,
        twSpeed: 1 + Math.random() * 1.6,
        tx: 0, ty: 0, sx: 0, sy: 0, sa: 0
      });
    }
  }
  layout();
}

/* ---------- 树上圆球装饰（配色与树体搭配、不撞色） ---------- */
function buildOrnaments() {
  ORNAMENTS.length = 0;
  const n = 26;
  for (let i = 0; i < n; i++) {
    ORNAMENTS.push({
      u: 0.28 + Math.random() * 0.67,
      theta: Math.random() * Math.PI * 2,
      rOff: Math.random(),
      size: 3 + Math.random() * 2.2,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 0.8 + Math.random() * 1.2,
      tx: 0, ty: 0, sx: 0, sy: 0, sa: 0
    });
  }
  layout();
}

/* ---------- 地面同色粒子铺色（树底尘粒） ---------- */
function buildGround() {
  GROUND_PARTICLES.length = 0;
  const n = 280;
  for (let i = 0; i < n; i++) {
    GROUND_PARTICLES.push({
      theta: Math.random() * Math.PI * 2,
      dist: 0.15 + 1.0 * Math.sqrt(Math.random()),
      jitter: (Math.random() - 0.5) * 6,
      size: 0.6 + Math.random() * 1.5,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 0.5 + Math.random() * 1.2,
      tx: 0, ty: 0
    });
  }
  layout();
}

/* ---------- 树顶五角星：闪光粒子构成（放大） ---------- */
function buildStar() {
  STAR_PARTICLES.length = 0;
  const R = 20, r = 8.5, pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    pts.push([rad * Math.cos(a), rad * Math.sin(a)]);
  }
  for (let e = 0; e < 10; e++) {
    const [x1, y1] = pts[e];
    const [x2, y2] = pts[(e + 1) % 10];
    for (let k = 0; k < 8; k++) {
      const f = k / 8;
      STAR_PARTICLES.push({
        x: x1 + (x2 - x1) * f,
        y: y1 + (y2 - y1) * f,
        tw: Math.random() * Math.PI * 2,
        twSpeed: 1 + Math.random() * 2,
        size: 1 + Math.random() * 1.2
      });
    }
  }
  for (let i = 0; i < 22; i++) {
    STAR_PARTICLES.push({
      x: (Math.random() - 0.5) * 11,
      y: (Math.random() - 0.5) * 11,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 1 + Math.random() * 2,
      size: 0.9 + Math.random() * 1
    });
  }
}

/* ---------- 树底圆形柔光（树图层之下，正圆） ---------- */
function drawGroundGlow(pal, reveal) {
  if (reveal <= 0) return;
  const gg = ctx.createRadialGradient(G.cx, G.baseY, 0, G.cx, G.baseY, G.R * 1.5);
  gg.addColorStop(0, pal.ribbon);
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.13 * reveal;
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(G.cx, G.baseY, G.R * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ---------- 背景对应色打光（雾光跟随树色） ---------- */
function drawAmbientLight(pal, reveal) {
  if (reveal <= 0) return;
  const cx = G.cx, cy = G.topY + G.treeH * 0.45;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
  g.addColorStop(0, rgbaOf(pal.tree[1], 0.20 * reveal));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createLinearGradient(0, G.baseY - H * 0.12, 0, H);
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, rgbaOf(pal.ribbon, 0.16 * reveal));
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
}

/* ---------- 地面同色粒子铺色 ---------- */
function drawGround(pal, reveal) {
  if (reveal <= 0) return;
  GROUND_PARTICLES.forEach(p => {
    const tw = 0.5 + 0.5 * Math.sin(performance.now() * 0.001 * p.twSpeed + p.tw);
    ctx.globalAlpha = reveal * tw * 0.7;
    ctx.fillStyle = rgbaOf(pal.tree[1], 1);
    ctx.beginPath();
    ctx.arc(p.tx, p.ty, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ---------- 背景灯光 ---------- */
function buildBokeh() {
  bokeh = [];
  const n = 34;
  for (let i = 0; i < n; i++) {
    bokeh.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.82,
      r: 1.5 + Math.random() * 4,
      warm: Math.random() < 0.7,
      phase: Math.random() * Math.PI * 2,
      sp: 0.4 + Math.random() * 0.9
    });
  }
  villageLights = [];
  for (let i = 0; i < 24; i++) {
    villageLights.push({
      x: (i + 0.5) * W / 24,
      y: H - 6 - Math.random() * 2,
      phase: Math.random() * Math.PI * 2
    });
  }
}

/* ---------- 飘雪 ---------- */
function newFlake(anyY) {
  return {
    x: Math.random() * W,
    y: anyY ? Math.random() * H : -10,
    r: 0.8 + Math.random() * 2.4,
    v: 0.4 + Math.random() * 1.1,
    drift: Math.random() * Math.PI * 2,
    driftA: 0.2 + Math.random() * 0.5,
    alpha: 0.4 + Math.random() * 0.6
  };
}

function ensureSnow() {
  const target = Math.floor(MAX_SNOW * state.snowAmount);
  while (snowFlakes.length < target) snowFlakes.push(newFlake(true));
  if (snowFlakes.length > target) snowFlakes.length = target;
}

/* ---------- 阶段切换 ---------- */
function setPhase(ph) {
  state.phase = ph;
  state.phaseStart = performance.now();
  updateHint();
  updatePanel();
  updateGreeting();
}

function elapsed() {
  return performance.now() - state.phaseStart;
}

/* ---------- 入场：雪花散开成飘雪 ---------- */
function burstSnowflake() {
  const cx = W * 0.5, cy = H * 0.42;
  shards = [];
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 3.0;
    shards.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.3,
      life: 1, r: 2 + Math.random() * 2.2,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.08
    });
  }
  setPhase('snowburst');
}

/* ---------- 入场：空中雪花大螺旋汇聚成树 ---------- */
function startGather() {
  const scatter = list => {
    list.forEach(p => {
      p.sx = G.cx + (Math.random() - 0.5) * G.R * 2.2;
      p.sy = G.baseY + Math.random() * 30;
      p.sa = Math.random() * Math.PI * 2;
    });
  };
  scatter(TREE_PARTICLES);
  scatter(RIBBON_PARTICLES);
  scatter(ORNAMENTS);
  setPhase('gather');
}

/* ---------- 宽叶分叉冰晶雪花（参考图：掌状宽枝） ---------- */
function drawSnowflake(cx, cy, R, opts = {}) {
  const { scale = 1, rot = 0, boost = 0 } = opts;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.shadowColor = `rgba(170, 210, 255, ${0.8 + boost * 0.2})`;
  ctx.shadowBlur = 16 + boost * 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let arm = 0; arm < 6; arm++) {
    ctx.save();
    ctx.rotate(arm * Math.PI / 3);

    // 主臂：外层柔光 + 宽厚亮芯
    ctx.strokeStyle = 'rgba(190, 220, 250, 0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R); ctx.stroke();
    ctx.strokeStyle = 'rgba(235, 245, 255, 0.92)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R); ctx.stroke();

    // 三对宽叶状侧枝，每枝末端再分叉出小尖
    const levels = [0.28, 0.52, 0.74];
    levels.forEach((f, idx) => {
      const y = -R * f;
      const len = R * (0.3 - idx * 0.05);
      ctx.strokeStyle = 'rgba(225, 240, 255, 0.85)';
      ctx.lineWidth = 2.0 - idx * 0.3;
      [-1, 1].forEach(side => {
        // 宽叶主枝
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(side * len, y - len * 0.45);
        ctx.stroke();
        // 叶尖分叉
        ctx.beginPath();
        ctx.moveTo(side * len * 0.7, y - len * 0.3);
        ctx.lineTo(side * len * 1.05, y - len * 0.55);
        ctx.stroke();
      });
    });

    // 臂尖收尖
    ctx.strokeStyle = 'rgba(235, 245, 255, 0.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.92);
    ctx.lineTo(0, -R * 1.05);
    ctx.stroke();

    ctx.restore();
  }

  // 中心结晶
  ctx.fillStyle = 'rgba(238, 248, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- 主绘制 ---------- */
function draw(now) {
  const pal = currentPalette();
  const t = now * 0.001;

  // 固定深冬背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 远处暖色散景灯光
  bokeh.forEach(b => {
    const flick = 0.55 + 0.45 * Math.sin(t * b.sp + b.phase);
    const col = b.warm ? '255, 196, 120' : '180, 210, 255';
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3);
    g.addColorStop(0, `rgba(${col}, ${0.5 * flick})`);
    g.addColorStop(1, `rgba(${col}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // 底部村落微光
  villageLights.forEach(v => {
    ctx.fillStyle = `rgba(255, 190, 110, ${0.25 + 0.2 * Math.sin(t + v.phase)})`;
    ctx.fillRect(v.x, v.y, 2, 2);
  });

  // 飘雪：雪花点击散开后才开始飘落
  const snowActive = state.phase !== 'snowflake';
  if (snowActive) {
    updateSnow();
    drawSnowLayer();
  }

  const cy = H * 0.42;

  if (state.phase === 'snowflake') {
    const R = Math.min(W, H) * 0.11;
    const cx = W * 0.5;
    const dist = Math.hypot(mouse.x - cx, mouse.y - cy);
    const hover = dist < R * 1.4;
    hoverAnim.t += ((hover ? 1 : 0) - hoverAnim.t) * 0.12;
    if (Math.abs(hoverAnim.t) < 0.001) hoverAnim.t = 0;
    const scale = 1 + 0.1 * hoverAnim.t;
    const rot = Math.sin(t * 0.6) * 0.08;
    drawSnowflake(cx, cy, R, { scale, rot });
    canvas.style.cursor = hover ? 'pointer' : 'default';
  } else if (state.phase === 'snowburst') {
    updateShards();
    drawShards();
    if (elapsed() > 1700) startGather();
  } else {
    canvas.style.cursor = 'default';
    let reveal = 1;
    if (state.phase === 'gather') {
      const k = Math.min(elapsed() / 3400, 1);
      reveal = 1 - Math.pow(1 - k, 3);
    }
    if (state.phase === 'tree' && now - lastFirework > 1000) {
      launchFirework(pal);
      if (Math.random() < 0.65) launchFirework(pal);
      lastFirework = now;
    }
    updateFireworks();
    drawFireworks();
    drawAmbientLight(pal, reveal);
    drawGroundGlow(pal, reveal);
    drawGround(pal, reveal);
    drawTreeAndRibbons(now, pal);
    drawStarTop(now, pal);
  }
}

/* ---------- 粒子树 + 粒子灯带 ---------- */
function gatherMotion(p, g, jitter) {
  if (state.phase === 'gather') {
    // 雪花粒子直接向目标点汇聚，不做螺旋轨迹
    return {
      x: p.sx + (p.tx - p.sx) * g,
      y: p.sy + (p.ty - p.sy) * g
    };
  }
  return {
    x: p.tx,
    y: p.ty
  };
}

function drawParticleDot(x, y, size, col, tw, reveal = 1) {
  ctx.globalAlpha = 0.18 * tw * reveal;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, size * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = tw * reveal;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

function drawTreeAndRibbons(now, pal) {
  if (state.phase === 'gather') {
    const k = Math.min(elapsed() / 3400, 1);
    if (k >= 1) setPhase('settle');
  } else if (state.phase === 'settle') {
    const k = Math.min(elapsed() / 1000, 1);
    if (k >= 1) setPhase('tree');
  }
  const jitter = 0;

  // 粒子汇聚后整体渐显，不做自下而上的生长分层
  const growK = state.phase === 'gather' ? Math.min(elapsed() / 3400, 1) : 1;
  const g = growK;

  TREE_PARTICLES.forEach(p => {
    if (g <= 0) return;
    const easeG = 1 - Math.pow(1 - g, 3);
    const pos = gatherMotion(p, easeG, jitter);
    const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * p.twSpeed + p.tw);
    const col = treeColor(pal, p.u);
    drawParticleDot(pos.x, pos.y, p.size, col, tw, g);
  });

  RIBBON_PARTICLES.forEach(p => {
    if (g <= 0) return;
    const easeG = 1 - Math.pow(1 - g, 3);
    const pos = gatherMotion(p, easeG, jitter);
    const tw = 0.7 + 0.3 * Math.sin(now * 0.001 * p.twSpeed + p.tw);
    // 加大光晕，灯带更明显
    ctx.globalAlpha = 0.28 * tw * g;
    ctx.fillStyle = pal.ribbon;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.size * 3, 0, Math.PI * 2);
    ctx.fill();
    // 彩色亮芯
    ctx.globalAlpha = tw * g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    // 白色高光核心
    ctx.globalAlpha = tw * g;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 圆球装饰：配色与树体搭配、不撞色
  ORNAMENTS.forEach(p => {
    if (g <= 0) return;
    const easeG = 1 - Math.pow(1 - g, 3);
    const pos = gatherMotion(p, easeG, jitter);
    const tw = 0.75 + 0.25 * Math.sin(now * 0.001 * p.twSpeed + p.tw);
    ctx.globalAlpha = 0.25 * tw * g;
    ctx.fillStyle = pal.ball;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.size * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = tw * g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(pos.x - p.size * 0.3, pos.y - p.size * 0.3, p.size * 0.32, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ---------- 树顶粒子五角星（树完全出现后渐亮浮现） ---------- */
function drawStarTop(now, pal) {
  let starK = 0;
  if (state.phase === 'tree') starK = Math.min(elapsed() / 400, 1);
  if (starK <= 0) return;
  const ease = 1 - Math.pow(1 - starK, 3);
  const starY = G.topY - 20;
  STAR_PARTICLES.forEach(sp => {
    const tw = 0.5 + 0.5 * Math.sin(now * 0.002 * sp.twSpeed + sp.tw);
    ctx.globalAlpha = tw * ease;
    ctx.fillStyle = pal.star;
    ctx.shadowColor = pal.star;
    ctx.shadowBlur = 6 * ease;
    ctx.beginPath();
    ctx.arc(G.cx + sp.x, starY + sp.y, sp.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/* ---------- 飘雪更新与绘制 ---------- */
function updateSnow() {
  ensureSnow();
  snowFlakes.forEach(f => {
    f.y += f.v;
    f.x += Math.sin(performance.now() * 0.001 + f.drift) * f.driftA * 0.4;
    if (f.y > H + 10) {
      f.y = -10;
      f.x = Math.random() * W;
    }
    if (f.x < -10) f.x = W + 10;
    if (f.x > W + 10) f.x = -10;
  });
}

function drawSnowLayer() {
  ctx.fillStyle = 'rgba(235, 244, 255, 0.9)';
  snowFlakes.forEach(f => {
    ctx.globalAlpha = f.alpha;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ---------- 雪花碎片 ---------- */
function updateShards() {
  shards.forEach(s => {
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.008;
    s.vx *= 0.995;
    s.rot += s.vr;
    s.life -= 0.008;
  });
  shards = shards.filter(s => s.life > 0);
}

function drawShards() {
  shards.forEach(s => {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.globalAlpha = Math.max(s.life, 0);
    ctx.strokeStyle = 'rgba(215, 238, 255, 0.9)';
    ctx.lineWidth = 1;
    for (let a = 0; a < 3; a++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(-s.r, 0); ctx.lineTo(s.r, 0);
      ctx.stroke();
    }
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

/* ---------- 粒子烟花（树左右两侧偏上，盛大绽放） ---------- */
function launchFirework(pal) {
  const panelW = W < 768 ? 230 : 280;
  const side = Math.random() < 0.5 ? -1 : 1;
  let x = G.cx + side * G.R * (0.7 + Math.random() * 0.9);
  x = Math.max(panelW + 24, Math.min(W - 24, x));
  const y = H * (0.12 + Math.random() * 0.26);
  const colors = [pal.star, pal.ribbon, pal.ball, '#ffffff'];
  const parts = [];
  const n = 72;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.2 + Math.random() * 2.6;
    parts.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1, decay: 0.008 + Math.random() * 0.007,
      size: 1 + Math.random() * 1.6,
      col: colors[Math.floor(Math.random() * colors.length)]
    });
  }
  // 高亮白芯粒
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.4 + Math.random() * 1.2;
    parts.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1, decay: 0.012,
      size: 1.8 + Math.random() * 1.2,
      col: '#ffffff'
    });
  }
  fireworks.push(parts);
}

function updateFireworks() {
  fireworks.forEach(parts => {
    parts.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= p.decay;
    });
  });
  fireworks = fireworks
    .map(parts => parts.filter(p => p.life > 0))
    .filter(parts => parts.length);
}

function drawFireworks() {
  fireworks.forEach(parts => {
    parts.forEach(p => {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  ctx.globalAlpha = 1;
}

/* ---------- 提示文案 ---------- */
const hintEl = document.getElementById('hint');
function updatePanel() {
  panelEl.classList.toggle('show', state.phase === 'tree');
}
function updateGreeting() {
  greetingEl.classList.toggle('show', state.phase === 'tree');
}
function updateHint() {
  const map = {
    snowflake: '点击雪花，唤来飘雪',
    snowburst: '',
    gather: '',
    settle: '',
    tree: ''
  };
  hintEl.textContent = map[state.phase] || '';
  hintEl.style.display = hintEl.textContent ? 'block' : 'none';
  if (state.phase === 'snowflake') {
    const R = Math.min(W, H) * 0.11;
    hintEl.style.left = '50%';
    hintEl.style.top = (H * 0.42 + R + 34) + 'px';
  }
}

/* ---------- 交互：点击画布雪花 ---------- */
canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('mouseleave', () => {
  mouse.x = -9999;
  mouse.y = -9999;
});
canvas.addEventListener('click', e => {
  const dx = e.clientX - W * 0.5;
  const dy = e.clientY - H * 0.42;
  const d = Math.hypot(dx, dy);
  if (state.phase === 'snowflake' && d < 140) burstSnowflake();
});

/* ---------- 雪量滑杆 ---------- */
const snowSlider = document.getElementById('snowSlider');
snowSlider.addEventListener('input', () => {
  state.snowAmount = snowSlider.value / 100;
});

/* ---------- 树色：预设 + 任意取色 ---------- */
const swatches = document.querySelectorAll('.swatch[data-palette]');
const customColor = document.getElementById('customColor');

function setPalette(name) {
  state.palette = name;
  swatches.forEach(s => s.classList.toggle('active', s.dataset.palette === name));
}
swatches.forEach(s => {
  s.addEventListener('click', () => setPalette(s.dataset.palette));
});
customColor.addEventListener('input', () => {
  state.palette = 'custom';
  state.customColor = customColor.value;
  swatches.forEach(s => s.classList.remove('active'));
});
setPalette('ice');

/* ---------- 主副祝福语 ---------- */
const mainEl = document.getElementById('greetingMain');
const subEl = document.getElementById('greetingSub');
const mainInput = document.getElementById('greetingMainInput');
const subInput = document.getElementById('greetingSubInput');
const sizeSlider = document.getElementById('sizeSlider');

mainInput.addEventListener('input', () => {
  state.mainText = mainInput.value || 'Merry Christmas';
  mainEl.textContent = state.mainText;
});
subInput.addEventListener('input', () => {
  state.subText = subInput.value || '愿你平安喜乐';
  subEl.textContent = state.subText;
});
sizeSlider.addEventListener('input', () => {
  state.greetingSize = Number(sizeSlider.value);
  mainEl.style.fontSize = state.greetingSize + 'px';
  subEl.style.fontSize = Math.round(state.greetingSize * 0.42) + 'px';
});

/* ---------- 尺寸自适应 ---------- */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layout();
  buildBokeh();
}

window.addEventListener('resize', resize);

/* ---------- 启动 ---------- */
function init() {
  resize();
  buildTree();
  buildRibbons();
  buildOrnaments();
  buildGround();
  buildStar();
  buildBokeh();
  mainEl.textContent = state.mainText;
  subEl.textContent = state.subText;
  mainEl.style.fontSize = state.greetingSize + 'px';
  subEl.style.fontSize = Math.round(state.greetingSize * 0.42) + 'px';
  updateHint();
  updatePanel();
  updateGreeting();
  requestAnimationFrame(loop);
}

function loop(now) {
  draw(now);
  requestAnimationFrame(loop);
}

init();
