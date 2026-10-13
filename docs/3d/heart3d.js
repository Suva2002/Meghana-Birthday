/* A glossy 3D heart for the hero section.
   Needs 3d/three.min.js (Three.js r150) to be loaded before this file.
   If WebGL or Three.js is missing, the heart hides itself and the rest of the page works as normal. */
(function () {
  'use strict';

  var box = document.getElementById('heart3d');
  if (!box) return;
  if (!window.THREE) { box.hidden = true; return; }

  var T = window.THREE;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (err) {
    box.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  box.appendChild(renderer.domElement);

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  /* lights: soft ambient, a white key light, a gold rim and a rose fill */
  scene.add(new T.AmbientLight(0xffe3ee, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 6, 8);
  scene.add(key);
  var rim = new T.PointLight(0xffb020, 1.6, 30);
  rim.position.set(-6, -2, 5);
  scene.add(rim);
  var fill = new T.PointLight(0xff7a9c, 1.2, 30);
  fill.position.set(6, -4, 4);
  scene.add(fill);

  /* heart outline, extruded with a rounded bevel */
  var shape = new T.Shape();
  shape.moveTo(5, 5);
  shape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  shape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  shape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  shape.bezierCurveTo(7, 0, 5, 5, 5, 5);

  var geometry = new T.ExtrudeGeometry(shape, {
    depth: 5,
    bevelEnabled: true,
    bevelSegments: 8,
    steps: 2,
    bevelSize: 2,
    bevelThickness: 2,
    curveSegments: 32
  });
  geometry.center();
  geometry.rotateZ(Math.PI); /* the outline is drawn point-up, so flip it */

  var material = new T.MeshPhysicalMaterial({
    color: 0xff4d7a,
    roughness: 0.22,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.15
  });
  var heart = new T.Mesh(geometry, material);
  heart.scale.setScalar(0.17);

  var group = new T.Group();
  group.add(heart);
  scene.add(group);

  /* a shell of tiny gold sparkles around the heart */
  var COUNT = 140;
  var positions = new Float32Array(COUNT * 3);
  for (var i = 0; i < COUNT; i++) {
    var r = 2.6 + Math.random() * 0.6;
    var a = Math.random() * Math.PI * 2;
    var b = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(b) * Math.cos(a);
    positions[i * 3 + 1] = r * Math.cos(b);
    positions[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
  }
  var sparkGeometry = new T.BufferGeometry();
  sparkGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  var sparks = new T.Points(sparkGeometry, new T.PointsMaterial({
    color: 0xffd27a,
    size: 0.07,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  }));
  scene.add(sparks);

  /* pointer tilt and tap pulse */
  var tx = 0, ty = 0, mx = 0, my = 0, pulse = 0;
  window.addEventListener('pointermove', function (e) {
    var rect = box.getBoundingClientRect();
    if (!rect.width) return;
    tx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2));
    ty = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height - 0.5) * 2));
  }, { passive: true });

  renderer.domElement.addEventListener('pointerdown', function (e) {
    pulse = 0.22;
    document.dispatchEvent(new CustomEvent('heart-tap', { detail: { x: e.clientX, y: e.clientY } }));
    if (!running) draw(performance.now());
  });

  function resize() {
    var w = box.clientWidth || 300;
    var h = box.clientHeight || w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw(performance.now());
  }

  var t0 = performance.now();
  function draw(now) {
    var t = (now - t0) / 1000;
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;
    var beat = 1 + 0.05 * Math.pow(Math.max(0, Math.sin(t * 3)), 3) + pulse;
    pulse *= 0.88;
    group.scale.setScalar(beat);
    group.position.y = reduce ? 0 : Math.sin(t * 1.2) * 0.12;
    group.rotation.y = reduce ? 0.5 : t * 0.7 + mx * 0.5;
    group.rotation.x = my * 0.3;
    sparks.rotation.y = reduce ? 0 : -t * 0.15;
    renderer.render(scene, camera);
  }

  var running = false, raf = 0, visible = true;
  function loop(now) {
    draw(now);
    if (running) raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(box);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }).observe(box);
  } else {
    start();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });
})();
