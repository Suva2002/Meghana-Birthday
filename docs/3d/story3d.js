/* The scroll-driven 3D story.
   One Three.js scene, eight chapters. As you scroll, the camera travels between small sets:
     0 KT session   1 ABAP objects   (office set)
     2 Ranchi pool                    (pool set)
     3 Distance  4 First trip  5 Forgotten laptop  6 Third trip  (Delhi-Nagpur map set)
     7 Now, two elephants             (finale set)
   Needs 3d/three.min.js (r150). If WebGL is missing, the story falls back to plain cards. */
(function () {
  'use strict';

  var story = document.getElementById('story');
  var stage = document.getElementById('story-stage');
  var canvas = document.getElementById('story3d');
  if (!story || !stage || !canvas) return;
  if (!window.THREE) { story.classList.add('no3d'); return; }

  var T = window.THREE;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'default' });
  } catch (err) {
    story.classList.add('no3d');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  var scene = new T.Scene();
  scene.background = new T.Color(0x1a1236);
  scene.fog = new T.FogExp2(0x1a1236, 0.016);
  var camera = new T.PerspectiveCamera(40, 1, 0.1, 400);

  /* ---------- small helpers ---------- */
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function smoother(x) { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* 0 before a, rises to 1 at b, stays 1 until d, falls to 0 at e */
  function bump(c, a, b, d, e) { return smooth((c - a) / (b - a)) * (1 - smooth((c - d) / (e - d))); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return new T.CanvasTexture(c);
  }
  function heartPath(x, cx, cy, s) {
    x.beginPath();
    x.moveTo(cx, cy + s * 0.9);
    x.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.7, cy - s * 1.1, cx, cy - s * 0.4);
    x.bezierCurveTo(cx + s * 0.7, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
    x.closePath();
  }
  function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  var glowTex = canvasTex(128, 128, function (x, w, h) {
    var g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  var heartTex = canvasTex(128, 128, function (x, w, h) {
    var g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffb3c6'); g.addColorStop(1, '#ff4d7a');
    x.fillStyle = g; heartPath(x, w / 2, h / 2 + 4, 40); x.fill();
  });

  function glowSprite(color, size, opacity) {
    var s = new T.Sprite(new T.SpriteMaterial({
      map: glowTex, color: color, transparent: true, opacity: opacity == null ? 1 : opacity,
      depthWrite: false, blending: T.AdditiveBlending
    }));
    s.scale.set(size, size, 1);
    return s;
  }

  /* text bubble drawn on a canvas and shown as a sprite */
  function label(text, o) {
    o = o || {};
    var fs = o.fs || 54, pad = o.pad || 26;
    var font = '700 ' + fs + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    var probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    var tw = Math.ceil(probe.measureText(text).width);
    var hw = o.heart ? Math.round(fs * 0.9) : 0;
    var w = tw + pad * 2 + hw, h = Math.round(fs + pad * 1.3);
    var tex = canvasTex(w, h, function (x) {
      x.font = font; x.textBaseline = 'middle';
      if (o.bg) { x.fillStyle = o.bg; roundRect(x, 2, 2, w - 4, h - 4, (h - 4) / 2); x.fill(); }
      if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = 4; roundRect(x, 2, 2, w - 4, h - 4, (h - 4) / 2); x.stroke(); }
      var tx = pad;
      if (o.heart) {
        x.fillStyle = '#ff4d7a'; heartPath(x, pad + fs * 0.3, h / 2, fs * 0.3); x.fill();
        tx += hw;
      }
      x.fillStyle = o.color || '#fff4ea';
      x.fillText(text, tx, h / 2 + 2);
    });
    var s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    var H = o.h || 0.8;
    s.scale.set(H * w / h, H, 1);
    s.renderOrder = 20;
    s.userData.baseScale = s.scale.clone();
    return s;
  }

  /* ---------- global stars ---------- */
  (function () {
    var n = 700, p = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      p[i * 3] = rand(-40, 240);
      p[i * 3 + 1] = rand(-4, 40);
      p[i * 3 + 2] = rand(-70, 5);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({
      color: 0xfff4ea, size: 0.22, map: glowTex, transparent: true, opacity: 0.85,
      depthWrite: false, blending: T.AdditiveBlending, fog: false
    })));
  })();

  /* ---------- lights (the count never changes, only the intensity) ---------- */
  var hemi = new T.HemisphereLight(0xcfd8ff, 0x3a1a4a, 0.5);
  var sun = new T.DirectionalLight(0xffffff, 0.4);
  sun.position.set(6, 12, 9);
  scene.add(hemi); scene.add(sun);
  function pointLight(color, dist) { var l = new T.PointLight(color, 0, dist); scene.add(l); return l; }
  var lOffice = pointLight(0xff9ab8, 40);
  var lPoolA = pointLight(0xff7a9c, 16);
  var lPoolB = pointLight(0x6ec6ff, 16);
  var lMap = pointLight(0xffd27a, 60);
  var lFinaleA = pointLight(0xff9ab8, 30);
  var lFinaleB = pointLight(0xffd27a, 30);

  /* ---------- sets ---------- */
  function makeSet(x) { var g = new T.Group(); g.position.set(x, 0, 0); scene.add(g); return g; }
  var office = makeSet(0), pool = makeSet(60), map = makeSet(120), finale = makeSet(180);

  /* ===== 0-1  OFFICE: the screen and the ABAP objects ===== */
  var codeLines = [
    '*&------------------------------------*',
    '*& Report  ZKT_DAY_ONE',
    '*& Coal India project, May 2025',
    '*&------------------------------------*',
    'REPORT zkt_day_one.',
    '',
    "DATA(lo_senior) = NEW zcl_dev( 'Suvasis' ).",
    "DATA(lo_junior) = NEW zcl_dev( 'Meghana' ).",
    '',
    'lo_senior->give_kt( lo_junior ).',
    '',
    '" somewhere in this session...',
    'lo_junior->start_liking( lo_senior ).'
  ];
  var KEYWORDS = /^(REPORT|DATA|NEW)$/;
  var codeTokens = codeLines.map(function (line) {
    var out = [], re = /('[^']*'|[A-Za-z_]+|\s+|.)/g, m;
    var comment = line.charAt(0) === '*' || line.charAt(0) === '"';
    while ((m = re.exec(line))) {
      var s = m[0], col = '#fff4ea';
      if (comment) col = '#b78fb0';
      else if (s.charAt(0) === "'") col = '#ff7a9c';
      else if (KEYWORDS.test(s)) col = '#ffb020';
      else if (s === '->' || s === '-' || s === '>') col = '#8fd0ff';
      out.push({ t: s, c: col });
    }
    return out;
  });
  var codeTotal = codeLines.reduce(function (a, l) { return a + l.length; }, 0);
  var codeCanvas = document.createElement('canvas');
  codeCanvas.width = 1000; codeCanvas.height = 600;
  var cx = codeCanvas.getContext('2d');
  var codeTex = new T.CanvasTexture(codeCanvas);
  var codeDrawn = -1;

  function drawCode(n) {
    n = Math.min(codeTotal, Math.floor(n));
    if (n === codeDrawn) return;
    codeDrawn = n;
    cx.fillStyle = '#120a26'; cx.fillRect(0, 0, 1000, 600);
    cx.fillStyle = '#1e1240'; cx.fillRect(0, 0, 1000, 52);
    ['#ff7a9c', '#ffb020', '#7be0a0'].forEach(function (c, i) {
      cx.fillStyle = c; cx.beginPath(); cx.arc(30 + i * 28, 26, 8, 0, 6.283); cx.fill();
    });
    cx.font = '600 22px Consolas, Menlo, "DejaVu Sans Mono", monospace';
    cx.fillStyle = '#b78fb0'; cx.textBaseline = 'middle';
    cx.fillText('ZKT_DAY_ONE   SE38   ABAP Editor', 130, 27);
    cx.font = '26px Consolas, Menlo, "DejaVu Sans Mono", monospace';
    cx.textBaseline = 'alphabetic';
    var left = n, y = 104, last = codeLines.length - 1;
    if (n >= codeTotal) {
      cx.fillStyle = 'rgba(255,77,122,0.22)';
      roundRect(cx, 18, y + last * 38 - 28, 964, 38, 8); cx.fill();
    }
    for (var li = 0; li < codeTokens.length && left > 0; li++) {
      var px = 36;
      for (var ti = 0; ti < codeTokens[li].length && left > 0; ti++) {
        var tk = codeTokens[li][ti], part = tk.t.slice(0, left);
        cx.fillStyle = tk.c;
        cx.fillText(part, px, y + li * 38);
        px += cx.measureText(part).width;
        left -= part.length;
      }
      if (left <= 0 && n < codeTotal) {
        cx.fillStyle = '#ffb020'; cx.fillRect(px + 2, y + li * 38 - 24, 13, 30);
      }
    }
    codeTex.needsUpdate = true;
  }

  var monitor = new T.Group();
  monitor.position.set(0, 1.2, 0);
  office.add(monitor);
  var frameMat = new T.MeshStandardMaterial({ color: 0x2a1c4e, roughness: 0.4, metalness: 0.5 });
  monitor.add(new T.Mesh(new T.BoxGeometry(6.5, 4.1, 0.3), frameMat));
  var screen = new T.Mesh(new T.PlaneGeometry(6.1, 3.66), new T.MeshBasicMaterial({ map: codeTex, toneMapped: false }));
  screen.position.z = 0.16;
  monitor.add(screen);
  var stand = new T.Mesh(new T.CylinderGeometry(0.14, 0.2, 1.2, 16), frameMat);
  stand.position.set(0, -2.6, -0.1);
  monitor.add(stand);
  var base = new T.Mesh(new T.CylinderGeometry(1.1, 1.2, 0.14, 32), frameMat);
  base.position.set(0, -3.2, -0.1);
  monitor.add(base);
  var halo = glowSprite(0xff7a9c, 15, 0.55);
  halo.position.set(0, 0, -1.2);
  monitor.add(halo);

  var dust = (function () {
    var n = 160, p = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, r = rand(5, 10);
      p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = rand(-3, 6); p[i * 3 + 2] = Math.sin(a) * r;
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    var pts = new T.Points(g, new T.PointsMaterial({
      color: 0xffd27a, size: 0.2, map: glowTex, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending
    }));
    office.add(pts);
    return pts;
  })();

  var tagWords = ['Reports', 'Interfaces', 'Conversions', 'Enhancements', 'Forms', 'Workflows'];
  var tagColors = ['rgba(255,122,156,0.92)', 'rgba(255,176,32,0.92)', 'rgba(110,198,255,0.92)', 'rgba(255,154,118,0.92)', 'rgba(190,150,255,0.92)', 'rgba(123,224,160,0.92)'];
  var tags = tagWords.map(function (w, i) {
    var s = label(w, { bg: tagColors[i], color: '#2a0c2e', fs: 56, h: 0.95 });
    office.add(s);
    return s;
  });

  /* ===== 2  POOL in Ranchi ===== */
  var waterGeo = new T.PlaneGeometry(60, 60, 56, 44);
  waterGeo.rotateX(-Math.PI / 2);
  var waterPos = waterGeo.attributes.position;
  var waterBase = new Float32Array(waterPos.array);
  var water = new T.Mesh(waterGeo, new T.MeshStandardMaterial({
    color: 0x0f6a8a, emissive: 0x04202e, roughness: 0.18, metalness: 0.55, flatShading: true
  }));
  water.position.set(0, 0, 14);
  pool.add(water);

  var deck = new T.Mesh(new T.BoxGeometry(60, 0.6, 28), new T.MeshStandardMaterial({ color: 0x1f2a40, roughness: 0.85 }));
  deck.position.set(0, 0, -16);
  pool.add(deck);
  var coping = new T.Mesh(new T.BoxGeometry(60, 0.22, 0.5), new T.MeshStandardMaterial({ color: 0x9fb4cc, roughness: 0.6 }));
  coping.position.set(0, 0.2, -1.85);
  pool.add(coping);
  var wall = new T.Mesh(new T.BoxGeometry(60, 4, 0.5), new T.MeshStandardMaterial({ color: 0x14243a, roughness: 0.9 }));
  wall.position.set(0, 1.7, -30.5);
  pool.add(wall);

  /* string lights: bulbs are soft glowing points */
  (function () {
    var rows = [{ z: -7.5, y: 5.4, sag: 1.5 }, { z: 2.5, y: 6.0, sag: 1.3 }, { z: -2.5, y: 7.2, sag: 1.6 }];
    var per = 26, p = new Float32Array(rows.length * per * 3), k = 0;
    rows.forEach(function (r) {
      for (var i = 0; i < per; i++) {
        var u = i / (per - 1);
        p[k++] = -17 + 34 * u;
        p[k++] = r.y - r.sag * (1 - Math.pow(2 * u - 1, 2));
        p[k++] = r.z;
      }
    });
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    pool.add(new T.Points(g, new T.PointsMaterial({
      color: 0xffd27a, size: 1.1, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending
    })));
    pool.add(new T.Points(g, new T.PointsMaterial({
      color: 0xffffff, size: 0.2, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending
    })));
  })();

  /* two seated figures: simple capsule bodies, one rose and one blue */
  function makeFigure(color, glow) {
    var g = new T.Group();
    var mat = new T.MeshStandardMaterial({ color: color, roughness: 0.55, emissive: glow, emissiveIntensity: 0.35 });
    var body = new T.Mesh(new T.CapsuleGeometry(0.3, 0.55, 6, 14), mat);
    body.position.y = 0.55;
    var head = new T.Mesh(new T.SphereGeometry(0.25, 20, 14), mat);
    head.position.y = 1.2;
    var legs = new T.Mesh(new T.CapsuleGeometry(0.17, 0.5, 4, 10), mat);
    legs.rotation.x = Math.PI / 2; legs.position.set(0, 0.2, 0.42);
    g.add(body); g.add(head); g.add(legs);
    var h = glowSprite(glow, 3.2, 0.5); h.position.y = 0.9; g.add(h);
    return g;
  }
  var figA = makeFigure(0xff8fae, 0xff4d7a);
  var figB = makeFigure(0x7cc8ff, 0x3a8dff);
  figA.position.set(-1.4, 0.3, -2.9);
  figB.position.set(1.4, 0.3, -2.9);
  figA.rotation.y = 0.12; figB.rotation.y = -0.12;
  /* they face the water (positive z) */
  pool.add(figA); pool.add(figB);

  /* ===== 3-6  MAP: Delhi and Nagpur ===== */
  var DELHI = new T.Vector3(-1.5, 0, -10), NAGPUR = new T.Vector3(1.5, 0, 10);
  var dotGrid = (function () {
    var p = [], x, z;
    for (x = -16; x <= 16; x += 1.6) for (z = -15; z <= 15; z += 1.6) p.push(x, 0, z);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(p), 3));
    var pts = new T.Points(g, new T.PointsMaterial({
      color: 0x7f8cff, size: 0.28, map: glowTex, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending
    }));
    map.add(pts);
    return pts;
  })();

  function makeMarker(pos, color, name) {
    var g = new T.Group();
    g.position.copy(pos);
    var core = new T.Mesh(new T.SphereGeometry(0.38, 24, 16), new T.MeshBasicMaterial({ color: color }));
    g.add(core);
    var ring = new T.Mesh(new T.RingGeometry(0.7, 0.85, 40), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    var beam = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 6, 8, 1, true), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.35 }));
    beam.position.y = 3;
    g.add(beam);
    var gl = glowSprite(color, 4, 0.7);
    g.add(gl);
    var lab = label(name, { bg: 'rgba(27,6,32,0.78)', stroke: 'rgba(255,211,223,0.5)', color: '#fff4ea', fs: 50, h: 0.85 });
    lab.position.y = 1.7;
    g.add(lab);
    map.add(g);
    return { g: g, ring: ring, glow: gl };
  }
  var mDelhi = makeMarker(DELHI, 0xffb020, 'Delhi');
  var mNagpur = makeMarker(NAGPUR, 0xff7a9c, 'Nagpur');

  function makeArc(h, color) {
    var curve = new T.QuadraticBezierCurve3(DELHI.clone(), new T.Vector3(0, h, 0), NAGPUR.clone());
    var pts = curve.getPoints(90), p = new Float32Array(pts.length * 3);
    pts.forEach(function (v, i) { p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; });
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    var m = new T.Points(g, new T.PointsMaterial({
      color: color, size: 0.34, map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending
    }));
    g.setDrawRange(0, 0);
    map.add(m);
    return { curve: curve, pts: m, count: pts.length };
  }
  var arcs = [makeArc(6, 0xffb020), makeArc(9, 0xff7a9c), makeArc(12, 0xfff4ea)];
  var callArc = new T.QuadraticBezierCurve3(DELHI.clone(), new T.Vector3(0, 3.2, 0), NAGPUR.clone());

  var callHearts = [];
  for (var ch = 0; ch < 7; ch++) {
    var sp = new T.Sprite(new T.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(0.8, 0.8, 1);
    map.add(sp);
    callHearts.push(sp);
  }
  var callLabel = label('video call', { bg: 'rgba(255,122,156,0.92)', color: '#2a0c2e', fs: 50, h: 0.8, heart: true });
  callLabel.position.set(0, 2.9, 0);
  map.add(callLabel);

  var plane = new T.Group();
  (function () {
    var white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x6677aa, emissiveIntensity: 0.35 });
    var accent = new T.MeshStandardMaterial({ color: 0xff4d7a, roughness: 0.5, emissive: 0xff4d7a, emissiveIntensity: 0.3 });
    var fus = new T.Mesh(new T.CapsuleGeometry(0.2, 1.0, 4, 10), white);
    fus.rotation.x = Math.PI / 2;
    var wing = new T.Mesh(new T.BoxGeometry(2.4, 0.06, 0.5), white);
    wing.position.z = 0.1;
    var tailWing = new T.Mesh(new T.BoxGeometry(0.9, 0.05, 0.26), accent);
    tailWing.position.z = -0.65;
    var fin = new T.Mesh(new T.BoxGeometry(0.05, 0.36, 0.3), accent);
    fin.position.set(0, 0.2, -0.65);
    plane.add(fus); plane.add(wing); plane.add(tailWing); plane.add(fin);
    plane.scale.setScalar(1.15);
    var gl = glowSprite(0xffd27a, 2.4, 0.5); plane.add(gl);
  })();
  map.add(plane);

  var TRAIL = 26;
  var trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3);
  var trailGeo = new T.BufferGeometry();
  trailGeo.setAttribute('position', new T.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new T.BufferAttribute(trailCol, 3));
  map.add(new T.Points(trailGeo, new T.PointsMaterial({
    size: 0.5, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending
  })));
  var trailHist = [];

  /* the forgotten laptop */
  var laptop = new T.Group();
  (function () {
    var shell = new T.MeshStandardMaterial({ color: 0xc9d3e6, roughness: 0.35, metalness: 0.6 });
    var b = new T.Mesh(new T.BoxGeometry(1.7, 0.09, 1.15), shell);
    var lid = new T.Group();
    lid.add(new T.Mesh(new T.BoxGeometry(1.7, 1.1, 0.06), shell));
    var scr = new T.Mesh(new T.PlaneGeometry(1.55, 0.95), new T.MeshBasicMaterial({ map: codeTex, toneMapped: false }));
    scr.position.z = 0.04;
    lid.add(scr);
    lid.position.set(0, 0.55, -0.55);
    lid.rotation.x = -0.28;
    laptop.add(b); laptop.add(lid);
    var gl = glowSprite(0x8fd0ff, 3.4, 0.45); gl.position.y = 0.7; laptop.add(gl);
  })();
  laptop.position.set(NAGPUR.x + 2.6, 0.1, NAGPUR.z + 0.8);
  laptop.scale.setScalar(0.001);
  map.add(laptop);
  var bubbleForgot = label('Left my laptop!', { bg: 'rgba(255,176,32,0.95)', color: '#2a0c2e', fs: 50, h: 0.8 });
  bubbleForgot.position.set(NAGPUR.x + 2.6, 3.4, NAGPUR.z + 0.8);
  map.add(bubbleForgot);
  var bubbleScold = label('SUVASIS!!', { bg: 'rgba(255,77,122,0.96)', color: '#ffffff', fs: 60, h: 1.0 });
  bubbleScold.position.set(NAGPUR.x - 0.2, 3.6, NAGPUR.z);
  map.add(bubbleScold);

  /* flights, expressed in chapter units (4 = centre of "first trip") */
  var FLIGHTS = [
    { arc: 0, c0: 3.7, c1: 4.45, dir: 1 },
    { arc: 0, c0: 4.55, c1: 4.95, dir: -1 },
    { arc: 1, c0: 5.05, c1: 5.5, dir: 1 },
    { arc: 1, c0: 5.88, c1: 6.05, dir: -1 },
    { arc: 2, c0: 6.1, c1: 6.5, dir: 1 }
  ];

  /* ===== 7  FINALE: two elephants and a heart ===== */
  var floor = new T.Mesh(new T.CircleGeometry(11, 64), new T.MeshStandardMaterial({ color: 0x3a1236, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  finale.add(floor);
  var floorGlow = glowSprite(0xff7a9c, 26, 0.35);
  floorGlow.position.y = 0.05;
  floorGlow.material.depthTest = false;
  floorGlow.renderOrder = -1;
  finale.add(floorGlow);

  var sphereGeo = new T.SphereGeometry(1, 28, 20);
  function mat(color, extra) {
    var o = { color: color, roughness: 0.6, metalness: 0 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }
  function ball(parent, material, r, x, y, z, sx, sy, sz) {
    var m = new T.Mesh(sphereGeo, material);
    m.scale.set(r * (sx || 1), r * (sy || 1), r * (sz || 1));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function makeElephant(bodyColor, earColor, innerColor) {
    var g = new T.Group();
    var bm = mat(bodyColor), em = mat(earColor), im = mat(innerColor, { roughness: 0.7 });
    var dark = mat(0x140a1e, { roughness: 0.15 });
    var white = new T.MeshBasicMaterial({ color: 0xffffff });
    var pink = new T.MeshBasicMaterial({ color: 0xff7a9c, transparent: true, opacity: 0.75 });

    var body = ball(g, bm, 1, 0, 1.55, 0, 1.35, 1.0, 1.0);
    var head = ball(g, bm, 0.85, 1.45, 1.95, 0, 1, 1, 1);
    var legs = [];
    [[0.7, 0.55], [0.7, -0.55], [-0.75, 0.55], [-0.75, -0.55]].forEach(function (p) {
      var leg = new T.Mesh(new T.CapsuleGeometry(0.3, 0.55, 4, 10), bm);
      leg.position.set(p[0], 0.55, p[1]);
      g.add(leg); legs.push(leg);
    });
    var ears = [];
    [1, -1].forEach(function (sd) {
      var pivot = new T.Group();
      pivot.position.set(1.1, 2.15, sd * 0.78);
      var outer = ball(pivot, em, 0.62, 0, 0, sd * 0.1, 0.13, 1.0, 0.85);
      var inner = ball(pivot, im, 0.46, 0, -0.03, sd * 0.19, 0.1, 0.95, 0.75);
      outer.position.x = -0.02;
      pivot.rotation.y = sd * 0.35;
      g.add(pivot);
      ears.push({ pivot: pivot, sd: sd, base: sd * 0.35 });
    });
    var eyes = [];
    [1, -1].forEach(function (sd) {
      var eye = ball(g, dark, 0.11, 2.07, 2.18, sd * 0.4, 1, 1, 1);
      ball(eye, white, 0.3, 0.45, 0.4, 0, 1, 1, 1);
      eyes.push(eye);
      ball(g, pink, 0.14, 1.98, 1.78, sd * 0.62, 1, 0.8, 0.6);
    });
    /* trunk: a chain of shrinking spheres that sways */
    var curve = new T.CatmullRomCurve3([
      new T.Vector3(2.0, 1.85, 0), new T.Vector3(2.55, 1.4, 0), new T.Vector3(3.0, 1.45, 0),
      new T.Vector3(3.35, 1.95, 0), new T.Vector3(3.42, 2.6, 0)
    ]);
    var trunk = [];
    for (var i = 0; i < 16; i++) {
      var u = i / 15;
      var s = ball(g, bm, lerp(0.42, 0.17, Math.pow(u, 0.8)), 0, 0, 0, 1, 1, 1);
      trunk.push({ mesh: s, u: u });
    }
    var tail = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([
      new T.Vector3(-1.3, 1.7, 0), new T.Vector3(-1.75, 1.45, 0.05), new T.Vector3(-1.9, 1.0, 0.1)
    ]), 12, 0.07, 8, false), bm);
    g.add(tail);
    var shadow = glowSprite(0x000000, 5.2, 0.35);
    shadow.material.blending = T.NormalBlending;
    shadow.position.y = 0.04;
    shadow.material.depthTest = false;
    shadow.renderOrder = 0;
    g.add(shadow);
    return { group: g, ears: ears, eyes: eyes, trunk: trunk, curve: curve, body: body, head: head };
  }
  var eleA = makeElephant(0x5cc8f5, 0x7fd6fb, 0xffc2d4);
  var eleB = makeElephant(0xff93b0, 0xffa6bf, 0xfff0f4);
  eleA.group.position.set(-3.55, 0, 0);
  eleB.group.position.set(3.55, 0, 0);
  eleB.group.rotation.y = Math.PI;
  finale.add(eleA.group); finale.add(eleB.group);

  var bigHeart = (function () {
    var s = new T.Shape();
    s.moveTo(5, 5);
    s.bezierCurveTo(5, 5, 4, 0, 0, 0);
    s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
    s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
    s.bezierCurveTo(16, 7, 16, 0, 10, 0);
    s.bezierCurveTo(7, 0, 5, 5, 5, 5);
    var geo = new T.ExtrudeGeometry(s, { depth: 5, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: 2, bevelThickness: 2, curveSegments: 28 });
    geo.center(); geo.rotateZ(Math.PI);
    var m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xff4d7a, roughness: 0.25, metalness: 0.1, emissive: 0xff2d62, emissiveIntensity: 0.35 }));
    m.scale.setScalar(0.105);
    var g = new T.Group();
    g.add(m);
    var gl = glowSprite(0xff7a9c, 7, 0.6); g.add(gl);
    g.position.set(0, 4.6, 0);
    finale.add(g);
    return g;
  })();

  var babyA = label('Baby', { bg: 'rgba(255,255,255,0.95)', color: '#c2185b', fs: 54, h: 0.9, heart: true });
  var babyB = label('Baby', { bg: 'rgba(255,255,255,0.95)', color: '#c2185b', fs: 54, h: 0.9, heart: true });
  babyA.position.set(-2.1, 4.3, 0.5);
  babyB.position.set(2.1, 4.3, 0.5);
  finale.add(babyA); finale.add(babyB);

  /* ---------- rising hearts (shared by several scenes) ---------- */
  var hearts = [];
  for (var hi = 0; hi < 44; hi++) {
    var hs = new T.Sprite(new T.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    hs.visible = false;
    scene.add(hs);
    hearts.push({ s: hs, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 0.5 });
  }
  var heartCursor = 0;
  function emitHeart(x, y, z, size, spread) {
    var h = hearts[heartCursor++ % hearts.length];
    h.s.position.set(x + rand(-spread, spread), y, z + rand(-spread * 0.5, spread * 0.5));
    h.vx = rand(-0.4, 0.4); h.vy = rand(0.9, 1.7); h.vz = rand(-0.2, 0.2);
    h.life = 0; h.max = rand(1.8, 2.8); h.size = (size || 0.6) * rand(0.7, 1.2);
    h.s.visible = true;
  }
  function emitHeartsAt(obj, localPos, n, size, spread) {
    var v = new T.Vector3().copy(localPos);
    obj.localToWorld(v);
    for (var i = 0; i < n; i++) emitHeart(v.x, v.y, v.z, size, spread);
  }
  function updateHearts(dt) {
    for (var i = 0; i < hearts.length; i++) {
      var h = hearts[i];
      if (!h.s.visible) continue;
      h.life += dt;
      var u = h.life / h.max;
      if (u >= 1) { h.s.visible = false; continue; }
      h.s.position.x += h.vx * dt; h.s.position.y += h.vy * dt; h.s.position.z += h.vz * dt;
      var sc = h.size * smooth(u * 6) * (1 - 0.35 * u);
      h.s.scale.set(sc, sc, 1);
      h.s.material.opacity = 1 - smooth((u - 0.6) / 0.4);
    }
  }

  /* ---------- camera plan ---------- */
  var KEYS = [
    { s: office, cam: [0, 1.8, 10.5], look: [0, 1, 0], bg: 0x1a1236, dens: 0.016 },
    { s: office, cam: [4.5, 3.4, 15], look: [0, 1.2, 0], bg: 0x20104a, dens: 0.014 },
    { s: pool, cam: [-3.6, 2.5, -12.8], look: [0, 1.4, 1], bg: 0x041c2a, dens: 0.014 },
    { s: map, cam: [0, 15, 27], look: [0, 1.5, 0], bg: 0x0a1330, dens: 0.012 },
    { s: map, cam: [10, 10, 23], look: [0, 2, 0], bg: 0x0b1236, dens: 0.012 },
    { s: map, cam: [9, 6, 19], look: [1, 1.5, 7], bg: 0x0e1038, dens: 0.012 },
    { s: map, cam: [-10, 10, 20], look: [0, 2, 4], bg: 0x150f3c, dens: 0.012 },
    { s: finale, cam: [0, 3.2, 14.5], look: [0, 2.7, 0], bg: 0x3a0f38, dens: 0.012 }
  ];
  var N = KEYS.length;
  var chapters = Array.prototype.slice.call(story.querySelectorAll('.chapter'));
  var dots = Array.prototype.slice.call(story.querySelectorAll('.story-dots li'));

  var aspect = 1, kFit = 1, viewW = 1, viewH = 1;
  function resize() {
    var w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    viewW = w; viewH = h;
    aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? 46 : 40;
    camera.updateProjectionMatrix();
    kFit = Math.max(0.58, Math.min(1, 0.38 + aspect * 0.78));
    [office, pool, map, finale].forEach(function (s) { s.scale.setScalar(kFit); });
    if (aspect < 1) finale.scale.setScalar(kFit * 0.82);
    invalidate();
  }

  /* where the viewer is in the story, as a number from 0 to 7 */
  function chapterPos() {
    var vc = window.innerHeight / 2, centers = [];
    for (var i = 0; i < chapters.length; i++) {
      var r = chapters[i].getBoundingClientRect();
      centers.push(r.top + r.height / 2);
    }
    if (!centers.length) return 0;
    if (vc <= centers[0]) return 0;
    for (var j = 0; j < centers.length - 1; j++) {
      if (vc < centers[j + 1]) return j + (vc - centers[j]) / (centers[j + 1] - centers[j]);
    }
    return centers.length - 1;
  }

  /* ---------- per-frame update ---------- */
  var time = 0, typed = 0, prevC = 0, jump = 0, tapBoost = 0;
  var ptrX = 0, ptrY = 0, ptrTX = 0, ptrTY = 0, activeIdx = -1;
  var tmpV = new T.Vector3(), tmpV2 = new T.Vector3(), camPos = new T.Vector3(), lookPos = new T.Vector3();
  var colA = new T.Color(), colB = new T.Color();
  var heartTimer = 0, callTimer = 0;

  function crossed(prev, cur, thr) { return (prev < thr && cur >= thr) || (prev > thr && cur <= thr); }

  function update(dt) {
    time += dt;
    var c = chapterPos();

    /* camera: hold on each chapter, glide between them */
    var i0 = Math.min(N - 2, Math.floor(c)), f = c - i0;
    var u = smoother((f - 0.22) / 0.56);
    var A = KEYS[i0], B = KEYS[i0 + 1];
    function keyCam(k, out) { return out.set(k.s.position.x + k.cam[0], k.cam[1], k.cam[2]); }
    function keyLook(k, out) { return out.set(k.s.position.x + k.look[0] * kFit, k.look[1] * kFit, k.look[2] * kFit); }
    keyCam(A, camPos); keyCam(B, tmpV); camPos.lerp(tmpV, u);
    keyLook(A, lookPos); keyLook(B, tmpV); lookPos.lerp(tmpV, u);

    /* portrait screens: step back and lift the scene above the text card */
    if (aspect < 1) {
      var back = 1 + (1 - aspect) * 0.55;
      tmpV.copy(camPos).sub(lookPos).multiplyScalar(back);
      camPos.copy(lookPos).add(tmpV);
      lookPos.y -= (1 - aspect) * 2.2;
    }

    /* flights */
    var planeLocal = tmpV2, flying = false;
    var cur = null;
    for (var fi = 0; fi < FLIGHTS.length; fi++) if (c >= FLIGHTS[fi].c0) cur = FLIGHTS[fi];
    var planeT = 0, planeDir = 1, planeArc = arcs[0];
    if (cur) {
      var tt = clamp01((c - cur.c0) / (cur.c1 - cur.c0));
      flying = tt > 0 && tt < 1;
      planeT = smooth(tt); planeDir = cur.dir; planeArc = arcs[cur.arc];
    }
    var pu = planeDir > 0 ? planeT : 1 - planeT;
    planeLocal.copy(planeArc.curve.getPoint(pu));
    if (!cur) planeLocal.y += Math.sin(time * 2) * 0.12;
    plane.position.copy(planeLocal);
    tmpV.copy(planeArc.curve.getTangent(pu)).multiplyScalar(planeDir).add(planeLocal);
    map.localToWorld(tmpV);
    plane.lookAt(tmpV);
    plane.rotation.z += Math.sin(time * 3) * 0.06;
    plane.visible = c > 2.7 && c < 6.9;

    var mapShown = c > 2.4 && c < 6.95;
    if (mapShown) {
      if (c > 3.4 && c < 6.9 && (flying || (cur && c < cur.c1 + 0.25))) {
        var follow = flying ? 0.32 : 0.12;
        map.localToWorld(tmpV.copy(planeLocal));
        lookPos.lerp(tmpV, follow);
      }
      /* arcs draw on as planes fly them */
      for (var ai = 0; ai < arcs.length; ai++) {
        var fr = 0;
        for (var fj = 0; fj < FLIGHTS.length; fj++) {
          if (FLIGHTS[fj].arc === ai && FLIGHTS[fj].dir > 0) fr = Math.max(fr, smooth((c - FLIGHTS[fj].c0) / (FLIGHTS[fj].c1 - FLIGHTS[fj].c0)));
        }
        arcs[ai].pts.geometry.setDrawRange(0, Math.ceil(fr * arcs[ai].count));
      }
      /* trail behind the plane */
      trailHist.unshift(planeLocal.x, planeLocal.y, planeLocal.z);
      if (trailHist.length > TRAIL * 3) trailHist.length = TRAIL * 3;
      var moving = flying ? 1 : 0;
      for (var ti = 0; ti < TRAIL; ti++) {
        var hx = trailHist[ti * 3], hy = trailHist[ti * 3 + 1], hz = trailHist[ti * 3 + 2];
        if (hx === undefined) { hx = planeLocal.x; hy = planeLocal.y; hz = planeLocal.z; }
        trailPos[ti * 3] = hx; trailPos[ti * 3 + 1] = hy; trailPos[ti * 3 + 2] = hz;
        var fade = Math.pow(1 - ti / TRAIL, 2) * 0.9 * moving;
        trailCol[ti * 3] = 1 * fade; trailCol[ti * 3 + 1] = 0.82 * fade; trailCol[ti * 3 + 2] = 0.45 * fade;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;

      /* markers pulse, and Nagpur flashes when a plane lands */
      var landPulse = 0;
      [4.45, 5.5, 6.5].forEach(function (lc) { landPulse = Math.max(landPulse, bump(c, lc - 0.02, lc + 0.03, lc + 0.1, lc + 0.3)); });
      var pr = 1 + ((time * 0.6) % 1) * 1.4;
      mDelhi.ring.scale.setScalar(pr); mDelhi.ring.material.opacity = 0.7 * (1 - ((time * 0.6) % 1));
      mNagpur.ring.scale.setScalar(pr + landPulse * 1.5); mNagpur.ring.material.opacity = 0.7 * (1 - ((time * 0.6) % 1)) + landPulse * 0.3;
      mNagpur.glow.scale.setScalar(4 + landPulse * 3);

      /* video-call hearts travel back and forth on a low arc */
      var callOn = bump(c, 2.6, 3.0, 3.75, 4.1);
      for (var hk = 0; hk < callHearts.length; hk++) {
        var q = ((time * 0.14 + hk / callHearts.length) % 1);
        var dirn = hk % 2 ? 1 : -1;
        var pq = dirn > 0 ? q : 1 - q;
        callHearts[hk].position.copy(callArc.getPoint(pq));
        callHearts[hk].position.y += Math.sin(time * 4 + hk) * 0.12;
        var s2 = 0.8 * callOn * (0.7 + 0.3 * Math.sin(time * 5 + hk));
        callHearts[hk].scale.set(s2, s2, 1);
        callHearts[hk].material.opacity = callOn;
      }
      callLabel.scale.copy(callLabel.userData.baseScale).multiplyScalar(callOn);
      callLabel.position.y = 2.9 + Math.sin(time * 1.6) * 0.12;

      /* laptop and the two bubbles */
      var lapOn = bump(c, 4.6, 4.78, 5.85, 5.98);
      var pop = lapOn * (1 + 0.12 * Math.sin(time * 5));
      laptop.scale.setScalar(Math.max(0.001, lapOn) * (lapOn > 0.98 ? 1 + 0.04 * Math.sin(time * 5) : 1));
      laptop.rotation.y = -0.5 + Math.sin(time * 0.8) * 0.15;
      var fo = bump(c, 4.7, 4.85, 5.2, 5.4);
      bubbleForgot.scale.copy(bubbleForgot.userData.baseScale).multiplyScalar(fo);
      bubbleForgot.position.y = 3.4 + Math.sin(time * 2) * 0.1;
      var so = bump(c, 5.48, 5.58, 5.82, 5.92);
      bubbleScold.scale.copy(bubbleScold.userData.baseScale).multiplyScalar(so);
      bubbleScold.position.x = NAGPUR.x - 0.2 + Math.sin(time * 38) * 0.08 * so;
      if (crossed(prevC, c, 5.5) && c > prevC) emitHeartsAt(map, NAGPUR.clone().setY(1), 3, 0.5, 0.5);
      if (crossed(prevC, c, 6.5) && c > prevC) emitHeartsAt(map, NAGPUR.clone().setY(1.5), 14, 0.8, 1.6);
      if (crossed(prevC, c, 4.45) && c > prevC) emitHeartsAt(map, NAGPUR.clone().setY(1.2), 8, 0.7, 1.2);
      callTimer += dt;
      if (callOn > 0.5 && callTimer > 0.7) {
        callTimer = 0;
        emitHeartsAt(map, (Math.random() < 0.5 ? DELHI : NAGPUR).clone().setY(1.2), 1, 0.6, 0.3);
      }
    }

    /* office */
    var officeShown = c < 2.7;
    if (officeShown) {
      if (reduce) typed = codeTotal;
      else if (stage.getBoundingClientRect().top < window.innerHeight * 0.5) typed = Math.min(codeTotal, typed + dt * 52);
      drawCode(reduce ? codeTotal : Math.floor(typed / 2) * 2);
      monitor.position.y = 1.2 + Math.sin(time * 0.9) * 0.1;
      monitor.rotation.y = Math.sin(time * 0.35) * 0.08;
      dust.rotation.y = time * 0.03;
      var tagOn = smooth((c - 0.45) / 0.45) * (1 - smooth((c - 1.7) / 0.6));
      for (var gi = 0; gi < tags.length; gi++) {
        var ang = time * 0.32 + gi * Math.PI / 3;
        tags[gi].position.set(Math.cos(ang) * 6.6, 1.2 + Math.sin(time * 0.8 + gi) * 0.55 + (gi % 2 ? 0.9 : -0.6), Math.sin(ang) * 4.2);
        tags[gi].scale.copy(tags[gi].userData.baseScale).multiplyScalar(tagOn);
      }
    }

    /* pool */
    var poolShown = c > 1.3 && c < 2.85;
    if (poolShown) {
      var arr = waterPos.array;
      for (var wi = 0; wi < arr.length; wi += 3) {
        var wx = waterBase[wi], wz = waterBase[wi + 2];
        arr[wi + 1] = Math.sin(wx * 0.5 + time * 1.2) * 0.09 + Math.sin(wz * 0.7 + time * 0.9) * 0.08 + Math.sin((wx + wz) * 0.3 - time * 0.6) * 0.05;
      }
      waterPos.needsUpdate = true;
      var near = smooth((c - 1.9) / 1.0);
      var gap = lerp(1.4, 0.55, near);
      figA.position.x = -gap; figB.position.x = gap;
      figA.rotation.z = Math.sin(time * 1.1) * 0.03 + near * 0.06;
      figB.rotation.z = Math.sin(time * 1.1 + 1) * 0.03 - near * 0.06;
      figA.position.y = 0.3 + Math.max(0, Math.sin(time * 2.4)) * 0.04;
      figB.position.y = 0.3 + Math.max(0, Math.sin(time * 2.4 + 2)) * 0.04;
      heartTimer += dt;
      if (c > 1.9 && c < 2.7 && heartTimer > 0.55) {
        heartTimer = 0;
        var who = Math.random() < 0.5 ? figA : figB;
        emitHeartsAt(pool, tmpV.set(who.position.x, 2.0, who.position.z), 1, 0.45, 0.2);
      }
    }

    /* finale */
    var finShown = c > 5.9;
    if (finShown) {
      var fOn = smooth((c - 6.4) / 0.6);
      jump = Math.max(0, jump - dt * 1.6);
      var jy = Math.sin(Math.PI * (1 - jump)) * (jump > 0 ? 0.8 : 0);
      [eleA, eleB].forEach(function (e, idx) {
        var ph = idx * 1.3;
        e.group.position.y = Math.abs(Math.sin(time * 1.6 + ph)) * 0.06 + jy;
        e.group.rotation.z = Math.sin(time * 1.6 + ph) * 0.012;
        e.ears.forEach(function (ear) {
          ear.pivot.rotation.y = ear.base + ear.sd * Math.sin(time * 3.2 + ph) * 0.14 + ear.sd * (jump > 0 ? Math.sin(time * 18) * 0.25 : 0);
        });
        for (var ti2 = 0; ti2 < e.trunk.length; ti2++) {
          var tk = e.trunk[ti2], uu = tk.u, p = e.curve.getPoint(uu);
          tk.mesh.position.set(p.x, p.y + Math.sin(time * 2.2 - uu * 3 + ph) * 0.06 * uu, p.z + Math.sin(time * 1.7 + uu * 2 + ph) * 0.04 * uu);
        }
        var bl = (time + idx * 1.7) % 3.6 < 0.14 ? 0.12 : 1;
        e.eyes.forEach(function (eye) { eye.scale.y = 0.11 * bl; });
      });
      bigHeart.position.y = 4.6 + Math.sin(time * 1.3) * 0.18 + jy * 0.4;
      var beat = 1 + 0.07 * Math.pow(Math.max(0, Math.sin(time * 3.2)), 3) + tapBoost;
      tapBoost *= 0.9;
      bigHeart.scale.setScalar(beat * fOn);
      var swap = Math.sin(time * 1.5);
      babyA.scale.copy(babyA.userData.baseScale).multiplyScalar(fOn * (0.35 + 0.65 * smooth(swap * 1.5 + 0.5)));
      babyB.scale.copy(babyB.userData.baseScale).multiplyScalar(fOn * (0.35 + 0.65 * smooth(-swap * 1.5 + 0.5)));
      babyA.position.y = 4.3 + Math.sin(time * 2) * 0.1; babyB.position.y = 4.3 + Math.sin(time * 2 + 1.5) * 0.1;
      bigHeart.rotation.y = Math.sin(time * 0.6) * 0.5;
      heartTimer += dt;
      if (fOn > 0.5 && heartTimer > 0.45) {
        heartTimer = 0;
        emitHeartsAt(finale, tmpV.set(rand(-0.6, 0.6), 5.0, 0.2), 1, 0.7, 0.3);
      }
    }

    updateHearts(dt);

    /* visibility keeps draw calls low */
    office.visible = c < 2.7;
    pool.visible = poolShown;
    map.visible = mapShown;
    finale.visible = finShown;

    /* lights follow the chapter */
    lOffice.intensity = 1.0 * (1 - smooth((c - 1.8) / 0.8));
    lOffice.position.set(2, 4, 8);
    var pw = bump(c, 1.4, 2.0, 2.4, 2.8);
    lPoolA.intensity = 1.1 * pw; lPoolB.intensity = 1.0 * pw;
    figA.getWorldPosition(lPoolA.position); lPoolA.position.y += 1.5; lPoolA.position.z -= 1.8;
    figB.getWorldPosition(lPoolB.position); lPoolB.position.y += 1.5; lPoolB.position.z -= 1.8;
    lMap.intensity = 1.1 * bump(c, 2.4, 3.0, 6.3, 6.9);
    lMap.position.set(120, 14, 4);
    var fl = smooth((c - 6.0) / 0.9);
    lFinaleA.intensity = 0.6 * fl; lFinaleB.intensity = 0.45 * fl;
    lFinaleA.position.set(176, 7, 9); lFinaleB.position.set(184, 6, 8);
    hemi.intensity = 0.5 + 0.05 * fl;

    /* background colour */
    colA.setHex(A.bg); colB.setHex(B.bg); colA.lerp(colB, u);
    scene.background.copy(colA);
    scene.fog.color.copy(colA);
    scene.fog.density = lerp(A.dens, B.dens, u);

    /* pointer parallax and a gentle drift */
    ptrX += (ptrTX - ptrX) * 0.05; ptrY += (ptrTY - ptrY) * 0.05;
    camera.position.set(camPos.x + ptrX * 0.7 + Math.sin(time * 0.25) * 0.15, camPos.y - ptrY * 0.4 + Math.sin(time * 0.2) * 0.1, camPos.z);
    camera.lookAt(lookPos);
    var sideA = (i0 % 2 === 0) ? 1 : -1, sideB = ((i0 + 1) % 2 === 0) ? 1 : -1;
    var shift = Math.min(0.15, Math.max(0, (aspect - 1) * 0.4)) * lerp(sideA, sideB, u);
    if (shift !== 0) camera.setViewOffset(viewW, viewH, -shift * viewW, 0, viewW, viewH);
    else camera.clearViewOffset();

    /* chapter cards and dots */
    var idx = Math.round(c);
    if (idx !== activeIdx) {
      activeIdx = idx;
      chapters.forEach(function (el, k) { el.classList.toggle('on', k === idx); });
      dots.forEach(function (el, k) { el.classList.toggle('on', k === idx); });
    }
    prevC = c;
  }

  /* ---------- loop, visibility, input ---------- */
  var active = false, raf = 0, last = 0, dirty = true;
  function frame(now) {
    raf = 0;
    if (!active) return;
    var dt = reduce ? 0.016 : Math.min(0.1, ((now - last) / 1000) || 0.016);
    last = now;
    if (reduce && !dirty) return;
    dirty = false;
    update(reduce ? 0 : dt);
    renderer.render(scene, camera);
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  function invalidate() {
    dirty = true;
    if (active && !raf) raf = requestAnimationFrame(frame);
  }
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) { last = performance.now(); invalidate(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { setActive(es[0].isIntersecting && !document.hidden); }, { rootMargin: '120px 0px' }).observe(story);
  } else {
    setActive(true);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) setActive(false);
    else if (story.getBoundingClientRect().bottom > 0 && story.getBoundingClientRect().top < window.innerHeight) setActive(true);
  });
  window.addEventListener('scroll', function () { if (reduce) invalidate(); }, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', function (e) {
    ptrTX = (e.clientX / window.innerWidth - 0.5) * 2;
    ptrTY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  stage.addEventListener('pointerdown', function (e) {
    if (prevC > 6.5) {
      jump = 1; tapBoost = 0.25;
      emitHeartsAt(finale, tmpV.set(0, 5, 0.3), 10, 0.8, 1.2);
      document.dispatchEvent(new CustomEvent('heart-tap', { detail: { x: e.clientX, y: e.clientY } }));
      invalidate();
    }
  });

  resize();
  drawCode(reduce ? codeTotal : 0);
})();
