(() => {
  if (typeof THREE === "undefined") {
    document.body.textContent = "three.js missing";
    return;
  }

  const LIVE = !!(window.STREET_LIVE || document.documentElement.dataset.live === "1");
  const W = LIVE ? Math.max(320, window.innerWidth || 390) : 1920;
  const H = LIVE ? Math.max(240, window.innerHeight || 844) : 1080;

  const seed = (s) => {
    let h = s >>> 0;
    return () => {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rand = seed(0x51a7c33d);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  const canvas = document.getElementById("view") || document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  if (!canvas.parentNode) document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(LIVE ? Math.min(window.devicePixelRatio || 1, 1.5) : 1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;

  const scene = new THREE.Scene();

  // ---------------------------------------------------------------- textures
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  function grain(ctx, w, h, n, colors, alpha) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = colors[(rand() * colors.length) | 0];
      ctx.globalAlpha = alpha * (0.35 + rand() * 0.65);
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 2);
    }
    ctx.globalAlpha = 1;
  }

  const asphaltMap = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = "#38363a";
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 26000, ["#211f22", "#454348", "#2c2a2e", "#52505a"], 0.5);
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.16 + rand() * 0.2;
      ctx.fillStyle = rand() > 0.5 ? "#2a282c" : "#403e44";
      const px = rand() * w;
      const py = rand() * h;
      ctx.beginPath();
      ctx.ellipse(px, py, 40 + rand() * 130, 26 + rand() * 80, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = "#1b191c";
      ctx.beginPath();
      let px = rand() * w;
      let py = rand() * h;
      ctx.moveTo(px, py);
      for (let k = 0; k < 7; k++) {
        px += (rand() - 0.5) * 130;
        py += (rand() - 0.5) * 130;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  asphaltMap.wrapS = asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(9, 16);

  const walkMap = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = "#b9b0a4";
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 20000, ["#a49a8e", "#c8c0b4", "#948a80", "#d0c8bc"], 0.42);
    const cell = 256;
    ctx.lineWidth = 4;
    for (let y = 0; y <= h; y += cell) {
      for (let x = 0; x <= w; x += cell) {
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = "#7d7367";
        ctx.strokeRect(x, y, cell, cell);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = rand() > 0.5 ? "#a8a094" : "#c4bcb0";
        ctx.fillRect(x + 6, y + 6, cell - 12, cell - 12);
      }
    }
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = "#8a8074";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let px = rand() * w;
      let py = rand() * h;
      ctx.moveTo(px, py);
      for (let k = 0; k < 5; k++) {
        px += (rand() - 0.5) * 90;
        py += (rand() - 0.5) * 90;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  walkMap.wrapS = walkMap.wrapT = THREE.RepeatWrapping;
  walkMap.repeat.set(3, 14);

  function stuccoTex(base, tint) {
    return canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 16000, [tint, base, "rgba(255,255,255,0.5)", "rgba(60,40,25,0.4)"], 0.3);
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.ellipse(rand() * w, rand() * h, 20 + rand() * 60, 12 + rand() * 30, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function brickTex(base, mortar) {
    return canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = mortar;
      ctx.fillRect(0, 0, w, h);
      const bh = 22;
      const bw = 52;
      for (let row = 0, y = 0; y < h; row++, y += bh) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < w + bw; x += bw) {
          const shade = 0.82 + rand() * 0.36;
          ctx.fillStyle = base;
          ctx.globalAlpha = Math.min(1, shade);
          ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
        }
      }
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = "#2c1c14";
        ctx.fillRect(rand() * w, rand() * h, 3 + rand() * 20, 2 + rand() * 6);
      }
      ctx.globalAlpha = 1;
    });
  }

  function signTex(text, bg, fg, opts = {}) {
    const w = opts.w || 512;
    const h = opts.h || 128;
    return canvasTex(w, h, (ctx, tw, th) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, tw, th);
      if (opts.band) {
        ctx.fillStyle = opts.band;
        ctx.fillRect(0, 0, tw, 8);
        ctx.fillRect(0, th - 8, tw, 8);
      }
      grain(ctx, tw, th, 900, ["rgba(255,255,255,0.25)", "rgba(0,0,0,0.25)"], 0.3);
      ctx.fillStyle = fg;
      const size = opts.size || Math.floor(th * 0.46);
      ctx.font = `${opts.weight || 700} ${size}px ${opts.font || "ui-sans-serif, system-ui, sans-serif"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (opts.spacing) ctx.letterSpacing = `${opts.spacing}px`;
      ctx.fillText(text, tw / 2, th / 2 + 1);
      if (opts.sub) {
        ctx.font = `500 ${Math.floor(size * 0.42)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.globalAlpha = 0.75;
        ctx.fillText(opts.sub, tw / 2, th * 0.78);
        ctx.globalAlpha = 1;
      }
    });
  }

  function muralTex() {
    return canvasTex(512, 768, (ctx, w, h) => {
      ctx.fillStyle = "#e6d8c2";
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 9000, ["#d8c8b0", "#f0e4d0"], 0.3);
      const pal = ["#e0603c", "#2f4858", "#57967a", "#f0b429", "#c05a78", "#6b4e8a"];
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pal[i % pal.length];
        ctx.beginPath();
        ctx.arc(120 + (i % 3) * 130, 200 + i * 78, 90 + rand() * 60, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "#243040";
      ctx.beginPath();
      ctx.moveTo(40, h);
      ctx.lineTo(190, 420);
      ctx.lineTo(330, h);
      ctx.fill();
      ctx.fillStyle = "#4c7a52";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(200 + i * 22, 400 - i * 30, 110 - i * 12, 30, -0.5 + i * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function interiorTex(warm) {
    return canvasTex(256, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, warm ? "#c8843a" : "#7e8f9c");
      g.addColorStop(0.55, warm ? "#8a5424" : "#4d5a66");
      g.addColorStop(1, warm ? "#3a2413" : "#252d35");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = warm ? "#f0c078" : "#aebecb";
        ctx.fillRect(rand() * w, rand() * h * 0.7, 6 + rand() * 40, 3 + rand() * 26);
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = warm ? "#ffd89a" : "#d6e4ee";
      ctx.fillRect(0, 8, w, 5);
      ctx.fillRect(0, 30, w, 3);
      ctx.globalAlpha = 1;
    });
  }

  // ---------------------------------------------------------------- env / sky
  const envTex = canvasTex(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#4f7fa8");
    g.addColorStop(0.34, "#a9c2d2");
    g.addColorStop(0.5, "#f2cfa6");
    g.addColorStop(0.62, "#e2a071");
    g.addColorStop(1, "#5d4636");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const s = ctx.createRadialGradient(w * 0.74, h * 0.52, 4, w * 0.74, h * 0.52, 120);
    s.addColorStop(0, "#fff0cf");
    s.addColorStop(1, "rgba(255,220,170,0)");
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, w, h);
  });
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = envTex;
  scene.background = new THREE.Color(0xe9bd97);
  scene.fog = new THREE.FogExp2(0xe2ad86, 0.0088);

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      hi: { value: new THREE.Color(0x4a79a4) },
      mid: { value: new THREE.Color(0xd6c3bb) },
      low: { value: new THREE.Color(0xf6cda2) },
      haze: { value: new THREE.Color(0xe9a978) },
      sunDir: { value: new THREE.Vector3(0.82, 0.26, 0.51).normalize() },
    },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: [
      "varying vec3 vP; uniform vec3 hi, mid, low, haze; uniform vec3 sunDir;",
      "void main(){",
      "  float y = vP.y;",
      "  vec3 c = mix(haze, low, smoothstep(-0.06, 0.10, y));",
      "  c = mix(c, mid, smoothstep(0.06, 0.30, y));",
      "  c = mix(c, hi, smoothstep(0.24, 0.86, y));",
      "  float d = max(dot(vP, normalize(sunDir)), 0.0);",
      "  c += vec3(0.34, 0.20, 0.08) * pow(d, 5.0);",
      "  c += vec3(0.55, 0.36, 0.16) * pow(d, 90.0);",
      "  float band = smoothstep(0.0, 0.055, y) * (1.0 - smoothstep(0.05, 0.18, y));",
      "  c += vec3(0.10, 0.05, 0.01) * band;",
      "  gl_FragColor = vec4(c, 1.0);",
      "}",
    ].join("\n"),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 48, 28), skyMat));

  // ---------------------------------------------------------------- camera / light
  const camera = new THREE.PerspectiveCamera(LIVE ? 42 : 38, W / H, 0.1, 700);
  if (LIVE) {
    camera.position.set(6.15, 2.85, 16.2);
    camera.lookAt(7.45, 1.08, 10.35);
  } else {
    camera.position.set(5.15, 1.72, 15.2);
    camera.lookAt(-1.15, 2.1, -16.5);
  }

  scene.add(new THREE.HemisphereLight(0xa8c8e4, 0x8a6a4e, 0.5));
  scene.add(new THREE.AmbientLight(0xffdcb8, 0.14));

  const sun = new THREE.DirectionalLight(0xffcf9a, 3.45);
  sun.position.set(34, 13.5, 21);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LIVE ? 1024 : 3072, LIVE ? 1024 : 3072);
  sun.shadow.bias = -0.00028;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 30, bottom: -16, near: 1, far: 150 });
  sun.target.position.set(-1, 0, -14);
  scene.add(sun, sun.target);

  const bounce = new THREE.DirectionalLight(0xa8c0d8, 0.5);
  bounce.position.set(-18, 7, -6);
  scene.add(bounce);

  const warmFill = new THREE.DirectionalLight(0xffb578, 0.42);
  warmFill.position.set(12, 3.2, 24);
  scene.add(warmFill);

  // ---------------------------------------------------------------- geo helpers
  const cache = new Map();
  const cached = (key, make) => {
    let g = cache.get(key);
    if (!g) {
      g = make();
      cache.set(key, g);
    }
    return g;
  };

  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
    cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 20),
    sph: new THREE.SphereGeometry(1, 24, 18),
    sphLo: new THREE.SphereGeometry(1, 14, 10),
    plane: new THREE.PlaneGeometry(1, 1),
  };

  const mat = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);

  function put(g, m, x, y, z, sx, sy, sz, parent) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    if (sx != null) o.scale.set(sx, sy, sz);
    o.castShadow = true;
    o.receiveShadow = true;
    (parent || scene).add(o);
    return o;
  }

  function roundRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = w / 2;
    const y = h / 2;
    r = Math.min(r, Math.min(w, h) / 2 - 0.001);
    s.moveTo(-x + r, -y);
    s.lineTo(x - r, -y);
    s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x, y - r);
    s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
    s.lineTo(-x + r, y);
    s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-x, -y + r);
    s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  // rounded box, centred, bevelled on all axes
  function rbox(w, h, d, r) {
    const key = `rb${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r.toFixed(3)}`;
    return cached(key, () => {
      const bt = Math.min(r * 0.7, d * 0.3);
      const depth = Math.max(0.002, d - 2 * bt);
      const g = new THREE.ExtrudeGeometry(roundRectShape(w, h, r), {
        depth,
        bevelEnabled: true,
        bevelThickness: bt,
        bevelSize: bt,
        bevelSegments: 2,
        curveSegments: 5,
      });
      g.translate(0, 0, -depth / 2);
      return g;
    });
  }

  // rounded-rect cross-section in the (z,y) plane, used by the lofts
  function sectionPts(halfW, yBot, yTop, rTop, rBot, seg) {
    const pts = [];
    const hh = (yTop - yBot) / 2;
    rTop = Math.min(rTop, halfW * 0.98, hh * 0.98);
    rBot = Math.min(rBot, halfW * 0.98, hh * 0.98);
    const yc0 = yBot + rBot;
    const yc1 = yTop - rTop;
    const arc = (cz, cy, r, a0, a1) => {
      for (let i = 0; i <= seg; i++) {
        const a = lerp(a0, a1, i / seg);
        pts.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    arc(halfW - rBot, yc0, rBot, -Math.PI / 2, 0);
    arc(halfW - rTop, yc1, rTop, 0, Math.PI / 2);
    arc(-halfW + rTop, yc1, rTop, Math.PI / 2, Math.PI);
    arc(-halfW + rBot, yc0, rBot, Math.PI, Math.PI * 1.5);
    return pts;
  }

  // sweep closed cross-sections along X into a solid
  function loft(stations) {
    const m = stations.length;
    const n = stations[0].pts.length;
    const pos = [];
    for (let i = 0; i < m; i++) {
      const st = stations[i];
      for (let j = 0; j < n; j++) pos.push(st.x, st.pts[j][1], st.pts[j][0]);
    }
    const idx = [];
    for (let i = 0; i < m - 1; i++) {
      for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % n;
        const a = i * n + j;
        const b = i * n + j2;
        const c = (i + 1) * n + j;
        const d = (i + 1) * n + j2;
        idx.push(a, c, b, b, c, d);
      }
    }
    // caps
    const capA = pos.length / 3;
    let cy = 0;
    let cz = 0;
    for (let j = 0; j < n; j++) {
      cy += stations[0].pts[j][1];
      cz += stations[0].pts[j][0];
    }
    pos.push(stations[0].x, cy / n, cz / n);
    for (let j = 0; j < n; j++) idx.push(capA, (j + 1) % n, j);
    const capB = pos.length / 3;
    cy = 0;
    cz = 0;
    for (let j = 0; j < n; j++) {
      cy += stations[m - 1].pts[j][1];
      cz += stations[m - 1].pts[j][0];
    }
    pos.push(stations[m - 1].x, cy / n, cz / n);
    const base = (m - 1) * n;
    for (let j = 0; j < n; j++) idx.push(capB, base + j, base + ((j + 1) % n));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // ---------------------------------------------------------------- materials
  const M = {
    asphalt: mat({ map: asphaltMap, color: 0xffffff, roughness: 0.94, metalness: 0.02 }),
    walk: mat({ map: walkMap, color: 0xffffff, roughness: 0.9 }),
    curb: mat({ color: 0xb3aa9e, roughness: 0.82 }),
    curbTop: mat({ color: 0xc4bcb0, roughness: 0.8 }),
    dirt: mat({ color: 0x8f7c62, roughness: 1 }),
    lineW: mat({ color: 0xe6e0d2, roughness: 0.62 }),
    lineY: mat({ color: 0xd0a83c, roughness: 0.66 }),
    lineFade: mat({ color: 0xa89880, roughness: 0.84 }),
    glass: phys({ color: 0x3d5866, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.42, envMapIntensity: 1.5 }),
    shopGlass: phys({ color: 0x53707e, roughness: 0.05, metalness: 0.08, transparent: true, opacity: 0.32, envMapIntensity: 1.7 }),
    carGlass: phys({ color: 0x2c4450, roughness: 0.05, metalness: 0.12, transparent: true, opacity: 0.56, envMapIntensity: 1.6 }),
    chrome: phys({ color: 0xcfd4d8, roughness: 0.13, metalness: 1, envMapIntensity: 1.5 }),
    darkChrome: phys({ color: 0x6e7478, roughness: 0.24, metalness: 0.95, envMapIntensity: 1.1 }),
    black: mat({ color: 0x17171a, roughness: 0.6, metalness: 0.25 }),
    rubber: mat({ color: 0x191a1c, roughness: 0.95, metalness: 0.02 }),
    steel: phys({ color: 0x767b80, roughness: 0.36, metalness: 0.72, envMapIntensity: 0.9 }),
    steelDark: phys({ color: 0x3c4045, roughness: 0.42, metalness: 0.62 }),
    rust: mat({ color: 0x7d4630, roughness: 0.86, metalness: 0.14 }),
    frame: mat({ color: 0x413730, roughness: 0.56 }),
    frameLight: mat({ color: 0xd8cfc2, roughness: 0.5 }),
    trim: mat({ color: 0xd4c9b8, roughness: 0.66 }),
    trimDark: mat({ color: 0x9a8c78, roughness: 0.72 }),
    plinth: mat({ color: 0x7e7466, roughness: 0.84 }),
    bark: mat({ color: 0x8c7150, roughness: 0.94 }),
    frond: mat({ color: 0x53703c, roughness: 0.74, side: THREE.DoubleSide }),
    frondDark: mat({ color: 0x3a5029, roughness: 0.8, side: THREE.DoubleSide }),
    coconut: mat({ color: 0x6f5a3a, roughness: 0.85 }),
    hedge: mat({ color: 0x435c34, roughness: 0.9 }),
    hillNear: mat({ color: 0x9a8874, roughness: 1 }),
    hillMid: mat({ color: 0xb09a84, roughness: 1 }),
    hillFar: mat({ color: 0xc4ab94, roughness: 1 }),
    farBlock: mat({ color: 0xbfa793, roughness: 1 }),
    lamp: mat({ color: 0xffd79a, emissive: 0xffb762, emissiveIntensity: 1.15, roughness: 0.4 }),
    headlight: mat({ color: 0xfff2d4, emissive: 0xffe0a8, emissiveIntensity: 1.5, roughness: 0.2 }),
    tail: mat({ color: 0x8e1f22, emissive: 0x9c1c1c, emissiveIntensity: 0.85, roughness: 0.35 }),
    visorGlow: mat({ color: 0x6fe0ff, emissive: 0x49cdf5, emissiveIntensity: 1.9, roughness: 0.22 }),
    hydrant: phys({ color: 0xb03a2c, roughness: 0.42, metalness: 0.2 }),
    bench: mat({ color: 0x6a4a2c, roughness: 0.8 }),
    pole: mat({ color: 0x2c2e32, roughness: 0.48, metalness: 0.44 }),
    wire: mat({ color: 0x232427, roughness: 0.62 }),
    signGreen: mat({ color: 0x2c5f3c, roughness: 0.5 }),
    shade: mat({ color: 0x000000, transparent: true, opacity: 0.3 }),
  };

  const awnCols = [0xb44a3a, 0x33646b, 0xcbb078, 0x6b5a86, 0x3f6b48, 0xc08040];
  const awnMats = awnCols.map((c) => mat({ color: c, roughness: 0.72, side: THREE.DoubleSide }));

  const stuccoMats = [
    mat({ map: stuccoTex("#e3d2bb", "#c2a98d"), roughness: 0.9 }),
    mat({ map: stuccoTex("#d6a893", "#b07f6a"), roughness: 0.9 }),
    mat({ map: stuccoTex("#cfc7b6", "#a89e8c"), roughness: 0.9 }),
    mat({ map: stuccoTex("#e6ceae", "#c0a37e"), roughness: 0.9 }),
    mat({ map: stuccoTex("#c9b7a4", "#a08d79", "#fff"), roughness: 0.9 }),
    mat({ map: brickTex("#a8624a", "#c9b6a2"), roughness: 0.94 }),
    mat({ map: brickTex("#8e6a58", "#b6a695"), roughness: 0.94 }),
    mat({ map: stuccoTex("#dcc9bd", "#b39c8e"), roughness: 0.9 }),
  ];

  const interiorWarm = mat({ map: interiorTex(true), emissive: 0xffb060, emissiveIntensity: 0.5, roughness: 0.7 });
  const interiorCool = mat({ map: interiorTex(false), emissive: 0x8fb4c8, emissiveIntensity: 0.3, roughness: 0.7 });

  // ---------------------------------------------------------------- ground
  const ROAD = 7.0;
  const WALK = 10.7;

  function ground() {
    const road = put(G.box, M.asphalt, 0, -0.06, -26, ROAD * 2, 0.12, 150);
    road.castShadow = false;
    const cross = put(G.box, M.asphalt, 0, -0.062, 0, 120, 0.115, ROAD * 2);
    cross.castShadow = false;
    put(G.box, M.dirt, 0, -0.4, -20, 400, 0.6, 400).castShadow = false;

    // sidewalks (four quadrants around the intersection)
    const walkW = WALK - ROAD;
    const cx = (ROAD + WALK) / 2;
    for (const sx of [-1, 1]) {
      for (const [zc, zl] of [[-40, 66], [40, 66]]) {
        const s = put(G.box, M.walk, sx * cx, 0.09, zc, walkW, 0.18, zl);
        s.castShadow = false;
        put(G.box, M.curb, sx * (ROAD + 0.11), 0.06, zc, 0.22, 0.3, zl);
      }
      for (const xc of [-40, 40]) {
        const s = put(G.box, M.walk, xc, 0.09, sx * cx, 66, 0.18, walkW);
        s.castShadow = false;
        put(G.box, M.curb, xc, 0.06, sx * (ROAD + 0.11), 66, 0.3, 0.22);
      }
      // corner returns
      for (const sz of [-1, 1]) {
        const c = put(G.box, M.walk, sx * cx, 0.09, sz * cx, walkW, 0.18, walkW);
        c.castShadow = false;
      }
    }

    // lane markings down the main street
    for (let z = -92; z < 34; z += 4.6) {
      if (Math.abs(z) < ROAD + 1.4) continue;
      put(G.box, M.lineY, -0.19, 0.005, z, 0.13, 0.02, 2.5).castShadow = false;
      put(G.box, M.lineY, 0.19, 0.005, z, 0.13, 0.02, 2.5).castShadow = false;
      if (z % 9.2 < 4.6) {
        put(G.box, M.lineFade, -3.5, 0.004, z, 0.11, 0.02, 2.3).castShadow = false;
        put(G.box, M.lineFade, 3.5, 0.004, z, 0.11, 0.02, 2.3).castShadow = false;
      }
    }
    for (let x = -56; x < 56; x += 4.6) {
      if (Math.abs(x) < ROAD + 1.4) continue;
      put(G.box, M.lineY, x, 0.005, -0.19, 2.5, 0.02, 0.13).castShadow = false;
      put(G.box, M.lineY, x, 0.005, 0.19, 2.5, 0.02, 0.13).castShadow = false;
    }
    // crosswalk ladders
    for (const sz of [1, -1]) {
      for (let i = -6; i <= 6; i++) {
        put(G.box, M.lineW, i * 0.98, 0.008, sz * (ROAD + 0.9), 0.56, 0.02, 3.1).castShadow = false;
      }
      put(G.box, M.lineW, 0, 0.008, sz * (ROAD + 2.65), 13.6, 0.02, 0.16).castShadow = false;
    }
    for (const sx of [1, -1]) {
      for (let i = -6; i <= 6; i++) {
        put(G.box, M.lineW, sx * (ROAD + 0.9), 0.008, i * 0.98, 3.1, 0.02, 0.56).castShadow = false;
      }
    }
    // stop bars
    put(G.box, M.lineW, 3.5, 0.008, ROAD + 3.5, 6.6, 0.02, 0.4).castShadow = false;
    put(G.box, M.lineW, -3.5, 0.008, -ROAD - 3.5, 6.6, 0.02, 0.4).castShadow = false;

    // manholes, patches, drains
    const mh = (x, z, r) => {
      const o = put(G.cyl, M.steelDark, x, 0.012, z, r, 0.02, r);
      o.castShadow = false;
      put(G.cyl, M.rust, x, 0.02, z, r * 0.78, 0.012, r * 0.78).castShadow = false;
    };
    mh(-2.7, 5.2, 0.36);
    mh(3.1, -12.4, 0.32);
    mh(-4.4, -30.5, 0.34);
    for (const sx of [-1, 1]) {
      for (const z of [9.4, -15.6, -34.2]) {
        put(G.box, M.steelDark, sx * (ROAD - 0.25), 0.03, z, 0.4, 0.1, 0.9).castShadow = false;
      }
    }
  }

  // ---------------------------------------------------------------- facades
  function windowUnit(parent, x, y, w, h, opts = {}) {
    const depth = opts.depth ?? 0.34;
    const g = new THREE.Group();
    // reveal box (the hole in the wall)
    const rev = put(rbox(w, h, depth, 0.03), M.frame, 0, 0, -depth * 0.5, null, null, null, g);
    rev.castShadow = false;
    // interior / glass
    const interior = put(
      G.plane,
      opts.lit ? interiorWarm : interiorCool,
      0,
      0,
      -depth * 0.86,
      w * 0.96,
      h * 0.96,
      1,
      g
    );
    interior.castShadow = false;
    interior.receiveShadow = false;
    const glass = put(G.plane, M.glass, 0, 0, -0.06, w * 0.94, h * 0.94, 1, g);
    glass.castShadow = false;
    // frame ring + mullions
    const ring = cached(`wf${w.toFixed(2)}_${h.toFixed(2)}`, () => {
      const s = roundRectShape(w + 0.14, h + 0.14, 0.03);
      const hole = roundRectShape(w - 0.06, h - 0.06, 0.02);
      s.holes.push(new THREE.Path(hole.getPoints(12).reverse()));
      const e = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false, curveSegments: 4 });
      e.translate(0, 0, -0.05);
      return e;
    });
    put(ring, opts.frameMat || M.frameLight, 0, 0, 0.02, null, null, null, g).castShadow = false;
    const bars = opts.bars ?? 1;
    for (let i = 1; i <= bars; i++) {
      put(G.box, opts.frameMat || M.frameLight, -w / 2 + (w * i) / (bars + 1), 0, 0.0, 0.045, h - 0.06, 0.07, g).castShadow = false;
    }
    if (opts.transom) {
      put(G.box, opts.frameMat || M.frameLight, 0, h * 0.5 - h * 0.26, 0, w - 0.06, 0.05, 0.07, g).castShadow = false;
    }
    // sill + lintel
    put(rbox(w + 0.4, 0.12, 0.3, 0.03), M.trim, 0, -h / 2 - 0.12, 0.1, null, null, null, g);
    put(rbox(w + 0.32, 0.14, 0.22, 0.03), M.trim, 0, h / 2 + 0.13, 0.06, null, null, null, g);
    if (opts.ac) {
      put(rbox(w * 0.5, 0.34, 0.4, 0.04), M.steel, 0, -h / 2 + 0.18, 0.2, null, null, null, g);
      put(G.box, M.steelDark, 0, -h / 2 + 0.18, 0.4, w * 0.42, 0.24, 0.03, g);
    }
    if (opts.shutter) {
      for (const s of [-1, 1]) {
        put(rbox(w * 0.44, h * 0.98, 0.07, 0.02), M.frame, s * (w * 0.5 + w * 0.24), 0, 0.12, null, null, null, g);
      }
    }
    g.position.set(x, y, 0);
    parent.add(g);
    return g;
  }

  function awning(parent, x, y, z, w, kind) {
    const g = new THREE.Group();
    const m = awnMats[kind % awnMats.length];
    const depth = 1.5;
    const segs = Math.max(3, Math.round(w / 0.62));
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(depth * 0.55, 0.05, depth, -0.52);
    shape.lineTo(depth, -0.62);
    shape.quadraticCurveTo(depth * 0.55, -0.06, 0, -0.1);
    shape.closePath();
    const canopy = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 10 });
    canopy.rotateY(Math.PI / 2);
    canopy.translate(-w / 2, 0, 0);
    const c = new THREE.Mesh(canopy, m);
    c.castShadow = true;
    c.receiveShadow = true;
    g.add(c);
    // scalloped valance
    for (let i = 0; i < segs; i++) {
      const sx = -w / 2 + (w * (i + 0.5)) / segs;
      put(G.cyl, m, sx, -0.62, depth, (w / segs) * 0.5, 0.16, (w / segs) * 0.5, g).rotation.x = Math.PI / 2;
    }
    put(G.box, M.steel, 0, -0.66, depth, w, 0.05, 0.05, g);
    for (const s of [-1, 1]) {
      const rod = put(G.cyl, M.steel, (s * w) / 2, -0.34, depth * 0.5, 0.032, depth * 1.16, 0.032, g);
      rod.rotation.x = Math.PI / 2 + 0.36;
    }
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  function storefront(parent, w, d, opts) {
    const faceZ = d / 2;
    const recess = 0.62;
    const sillH = 0.52;
    const headH = 3.0;
    const g = new THREE.Group();

    // back wall of the shop volume + lit interior
    const back = put(G.box, M.frame, 0, headH / 2, faceZ - recess - 0.06, w * 0.96, headH, 0.12, g);
    back.castShadow = false;
    const inner = put(
      G.plane,
      opts.cool ? interiorCool : interiorWarm,
      0,
      1.62,
      faceZ - recess,
      w * 0.9,
      headH - 0.7,
      1,
      g
    );
    inner.castShadow = false;
    inner.receiveShadow = false;
    // shelving silhouettes inside
    for (let i = 0; i < 4; i++) {
      const sx = -w * 0.34 + i * (w * 0.22);
      put(G.box, M.black, sx, 0.95 + (i % 2) * 0.35, faceZ - recess + 0.16, 0.5, 1.4, 0.16, g).castShadow = false;
    }
    // bulkhead
    put(rbox(w * 0.94, sillH, 0.5, 0.04), M.plinth, 0, sillH / 2, faceZ - 0.16, null, null, null, g);
    // glazing: two big panes + door
    const paneW = w * 0.3;
    for (const s of [-1, 1]) {
      const px = s * (w * 0.24);
      const pane = put(G.plane, M.shopGlass, px, sillH + (headH - sillH) * 0.5 - 0.1, faceZ - 0.1, paneW, headH - sillH - 0.3, 1, g);
      pane.castShadow = false;
      const ring = cached(`sf${paneW.toFixed(2)}`, () => {
        const sh = roundRectShape(paneW + 0.12, headH - sillH - 0.18, 0.02);
        const hole = roundRectShape(paneW - 0.02, headH - sillH - 0.32, 0.02);
        sh.holes.push(new THREE.Path(hole.getPoints(12).reverse()));
        const e = new THREE.ExtrudeGeometry(sh, { depth: 0.11, bevelEnabled: false, curveSegments: 4 });
        e.translate(0, 0, -0.055);
        return e;
      });
      put(ring, M.darkChrome, px, sillH + (headH - sillH) * 0.5 - 0.1, faceZ - 0.06, null, null, null, g).castShadow = false;
      put(G.box, M.darkChrome, px, sillH + (headH - sillH) * 0.5 - 0.1, faceZ - 0.04, 0.05, headH - sillH - 0.3, 0.09, g).castShadow = false;
    }
    // doorway
    put(G.box, M.darkChrome, 0, 1.16, faceZ - 0.12, 1.06, 2.32, 0.1, g);
    const dGlass = put(G.plane, M.shopGlass, 0, 1.2, faceZ - 0.07, 0.92, 2.1, 1, g);
    dGlass.castShadow = false;
    put(G.cyl, M.chrome, 0.34, 1.12, faceZ - 0.01, 0.028, 0.5, 0.028, g);
    // transom over the door
    put(G.box, M.frameLight, 0, 2.46, faceZ - 0.1, 1.2, 0.1, 0.12, g).castShadow = false;
    // header beam + cornice over the whole shop
    put(rbox(w + 0.2, 0.42, 0.66, 0.05), M.trim, 0, headH + 0.2, faceZ - 0.06, null, null, null, g);
    put(rbox(w + 0.44, 0.2, 0.86, 0.05), M.trimDark, 0, headH + 0.52, faceZ + 0.02, null, null, null, g);
    // side pilasters framing the bay
    for (const s of [-1, 1]) {
      put(rbox(0.34, headH + 0.3, 0.72, 0.04), M.trim, (s * (w + 0.1)) / 2, (headH + 0.3) / 2, faceZ - 0.1, null, null, null, g);
    }
    // step
    put(G.box, M.curbTop, 0, 0.04, faceZ + 0.18, 1.5, 0.1, 0.42, g).castShadow = false;

    if (opts.awning != null) awning(g, 0, headH + 0.02, faceZ + 0.06, w * 0.9, opts.awning);
    if (opts.sign) {
      const board = put(rbox(Math.min(w * 0.78, 4.6), 0.78, 0.16, 0.04), mat({ map: opts.sign, roughness: 0.46 }), 0, headH + 0.22, faceZ + 0.12, null, null, null, g);
      board.castShadow = false;
      for (const s of [-1, 1]) {
        const arm = put(G.cyl, M.steel, s * Math.min(w * 0.3, 1.7), headH + 0.72, faceZ + 0.06, 0.024, 0.4, 0.024, g);
        arm.rotation.x = 0.5;
        put(G.cone, M.steel, s * Math.min(w * 0.3, 1.7), headH + 0.62, faceZ + 0.28, 0.11, 0.16, 0.11, g).rotation.x = Math.PI - 0.5;
        put(G.sphLo, M.lamp, s * Math.min(w * 0.3, 1.7), headH + 0.54, faceZ + 0.3, 0.05, 0.05, 0.05, g).castShadow = false;
      }
    }
    if (opts.blade) {
      const bl = put(rbox(0.14, 1.7, 1.05, 0.05), mat({ map: opts.blade, roughness: 0.44 }), (w * 0.5) - 0.1, headH + 1.5, faceZ + 0.6, null, null, null, g);
      bl.castShadow = false;
      put(G.box, M.steel, (w * 0.5) - 0.2, headH + 2.3, faceZ + 0.34, 0.06, 0.06, 0.7, g);
    }
    parent.add(g);
  }

  function building(x, z, w, d, floors, opts = {}) {
    const r = seed(((x * 977 + z * 131) | 0) >>> 0);
    const g = new THREE.Group();
    const shopH = 3.72;
    const fh = opts.fh || 2.92;
    const h = shopH + floors * fh;
    const wall = stuccoMats[opts.wall % stuccoMats.length];
    const faceZ = d / 2;

    // mass: slight setback above the shop so the facade is not one slab
    put(G.box, wall, 0, shopH * 0.5, -0.18, w, shopH, d - 0.36, g);
    put(G.box, wall, 0, shopH + (h - shopH) * 0.5, 0, w, h - shopH, d, g);
    // plinth
    put(rbox(w + 0.16, 0.5, d + 0.12, 0.04), M.plinth, 0, 0.25, 0, null, null, null, g);

    storefront(g, w * 0.82, d, {
      awning: opts.awning,
      sign: opts.sign,
      blade: opts.blade,
      cool: opts.cool,
    });

    // pilasters running up the facade
    const bays = opts.bays || 3;
    const bayW = (w * 0.9) / bays;
    for (let i = 0; i <= bays; i++) {
      const px = -w * 0.45 + i * bayW;
      put(rbox(0.26, h - shopH - 0.2, 0.34, 0.03), M.trim, px, shopH + (h - shopH) * 0.5 - 0.1, faceZ + 0.08, null, null, null, g);
    }

    // window rhythm per floor, varied by pattern
    for (let f = 0; f < floors; f++) {
      const fy = shopH + fh * (f + 0.5) + 0.1;
      const pattern = (f + (opts.phase || 0)) % 3;
      // string course between floors
      put(rbox(w + 0.2, 0.14, 0.4, 0.03), M.trimDark, 0, shopH + fh * f + 0.12, faceZ + 0.06, null, null, null, g);
      for (let b = 0; b < bays; b++) {
        const bx = -w * 0.45 + bayW * (b + 0.5);
        const lit = r() < (opts.lit ?? 0.34);
        if (pattern === 0) {
          windowUnit(g, bx, fy, bayW * 0.52, fh * 0.62, { lit, bars: 1, transom: true, depth: 0.4, parent: g });
        } else if (pattern === 1) {
          const nw = bayW * 0.24;
          windowUnit(g, bx - bayW * 0.17, fy, nw, fh * 0.56, { lit, bars: 0, depth: 0.34 });
          windowUnit(g, bx + bayW * 0.17, fy, nw, fh * 0.56, { lit: r() < 0.4, bars: 0, depth: 0.34 });
        } else {
          windowUnit(g, bx, fy, bayW * 0.46, fh * 0.54, {
            lit,
            bars: 2,
            depth: 0.32,
            ac: r() < 0.3,
            shutter: opts.shutters && r() < 0.5,
          });
        }
      }
      // a balcony every other floor on some buildings
      if (opts.balcony && f % 2 === 1) {
        const by = shopH + fh * f + 0.34;
        put(rbox(w * 0.56, 0.12, 1.0, 0.03), M.trim, 0, by, faceZ + 0.5, null, null, null, g);
        for (let i = 0; i <= 12; i++) {
          put(G.cyl, M.steelDark, -w * 0.27 + (w * 0.54 * i) / 12, by + 0.34, faceZ + 0.94, 0.022, 0.62, 0.022, g).castShadow = false;
        }
        put(G.box, M.steelDark, 0, by + 0.66, faceZ + 0.94, w * 0.56, 0.055, 0.06, g);
        put(G.box, M.steelDark, 0, by + 0.36, faceZ + 0.5, w * 0.56, 0.05, 0.05, g).castShadow = false;
      }
    }

    // cornice stack + parapet
    put(rbox(w + 0.5, 0.26, d + 0.5, 0.05), M.trim, 0, h + 0.1, 0, null, null, null, g);
    put(rbox(w + 0.72, 0.2, d + 0.72, 0.05), M.trimDark, 0, h + 0.32, 0, null, null, null, g);
    put(rbox(w + 0.3, 0.5, d + 0.3, 0.04), wall, 0, h + 0.66, 0, null, null, null, g);
    // dentils under the cornice
    const dents = Math.floor(w / 0.52);
    for (let i = 0; i < dents; i++) {
      put(G.box, M.trimDark, -w / 2 + 0.26 + i * 0.52, h - 0.08, faceZ + 0.2, 0.2, 0.18, 0.2, g).castShadow = false;
    }

    // roof clutter
    if (opts.hvac) {
      put(rbox(1.7, 0.8, 1.3, 0.06), M.steel, -w * 0.2, h + 1.2, -d * 0.12, null, null, null, g);
      put(G.cyl, M.steelDark, -w * 0.2, h + 1.72, -d * 0.12, 0.42, 0.3, 0.42, g);
      put(G.cyl, M.steel, w * 0.24, h + 1.3, d * 0.06, 0.3, 1.0, 0.3, g);
      put(G.cyl, M.steelDark, w * 0.24, h + 1.86, d * 0.06, 0.36, 0.14, 0.36, g);
    }
    if (opts.tank) {
      const t = new THREE.Group();
      put(G.cyl, M.bark, 0, 1.5, 0, 0.78, 2.1, 0.78, t);
      put(G.cone, M.rust, 0, 2.85, 0, 0.86, 0.75, 0.86, t);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        put(G.cyl, M.steelDark, Math.cos(a) * 0.6, 0.24, Math.sin(a) * 0.6, 0.05, 0.5, 0.05, t);
      }
      for (const yy of [1.0, 1.9]) {
        const band = put(new THREE.TorusGeometry(0.79, 0.03, 6, 20), M.steelDark, 0, yy, 0, null, null, null, t);
        band.rotation.x = Math.PI / 2;
      }
      t.position.set(w * 0.12, h + 0.7, -d * 0.2);
      g.add(t);
    }
    if (opts.escape) {
      for (let f = 0; f < floors; f++) {
        const ey = shopH + fh * f + 0.5;
        put(G.box, M.rust, w * 0.5 + 0.42, ey, faceZ - 0.6, 0.06, 0.06, 1.5, g).castShadow = false;
        put(rbox(0.8, 0.06, 1.4, 0.02), M.rust, w * 0.5 + 0.42, ey, faceZ - 0.6, null, null, null, g);
        for (let i = 0; i <= 6; i++) {
          put(G.cyl, M.rust, w * 0.5 + 0.42, ey + 0.38, faceZ - 1.24 + i * 0.21, 0.016, 0.72, 0.016, g).castShadow = false;
        }
        put(G.box, M.rust, w * 0.5 + 0.78, ey + 0.74, faceZ - 0.6, 0.05, 0.05, 1.4, g).castShadow = false;
      }
    }
    if (opts.antenna) {
      put(G.cyl, M.steelDark, -w * 0.3, h + 2.2, d * 0.2, 0.05, 3.0, 0.05, g);
      for (let i = 0; i < 4; i++) {
        put(G.box, M.steelDark, -w * 0.3, h + 2.3 + i * 0.4, d * 0.2, 0.7 - i * 0.12, 0.035, 0.035, g).castShadow = false;
      }
    }
    if (opts.mural) {
      const mm = put(G.plane, mat({ map: muralTex(), roughness: 0.88 }), -w * 0.5 - 0.02, h * 0.52, 0, d * 0.72, h * 0.62, 1, g);
      mm.rotation.y = -Math.PI / 2;
      mm.castShadow = false;
    }

    g.position.set(x, 0, z);
    g.rotation.y = opts.rot || 0;
    scene.add(g);
    return g;
  }

  const NAMES = [
    ["BOT LUNCH", "#1f3c36", "#e8dfc8"],
    ["PALMA RECORDS", "#3a2530", "#efd3b4"],
    ["SOLAR WASH", "#3d3218", "#f4e3ad"],
    ["WIRE WORKS", "#1f2c3a", "#cfe1ee"],
    ["DUSK FLORAL", "#26382a", "#dcefc9"],
    ["NIGHT MARKET", "#2a2529", "#f2d69c"],
    ["ALDER PRINT", "#262a2c", "#e6e0d2"],
    ["TIDE & TONIC", "#1c3540", "#d8ecef"],
    ["VALLE HARDWARE", "#38291c", "#eed9ac"],
    ["ORBIT LAUNDRY", "#2b2f42", "#d5d9f0"],
    ["CORTE GROCER", "#333a22", "#e9edc0"],
    ["SIXTH ST BAKERY", "#3c2a22", "#f3ddbc"],
  ];

  function blocks() {
    const rowZ = [11.5, 1.2, -9.5, -20.4, -31.5, -42.6, -53.8, -65, -76.2, -87.4];
    let n = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < rowZ.length; i++) {
        const z = rowZ[i] * 1.0;
        if (Math.abs(z) < 7.5) continue; // intersection gap
        const w = 9.4 + ((n * 7) % 5) * 0.7;
        const floors = 2 + ((n * 3 + i) % 5);
        const nm = NAMES[n % NAMES.length];
        building(side * (WALK + 4.3), z, w, 8.4, floors, {
          rot: side < 0 ? Math.PI / 2 : -Math.PI / 2,
          wall: n + i,
          bays: 2 + (n % 3),
          phase: n % 3,
          awning: n % 3 === 0 ? n : null,
          sign: signTex(nm[0], nm[1], nm[2], { w: 512, h: 116, size: 52, spacing: 2 }),
          blade: n % 4 === 1 ? signTex(nm[0].split(" ")[0], nm[1], nm[2], { w: 128, h: 384, size: 34 }) : null,
          lit: 0.28 + (n % 4) * 0.09,
          hvac: n % 2 === 0,
          tank: n % 5 === 2,
          escape: n % 3 === 1,
          balcony: n % 3 === 2,
          shutters: n % 4 === 3,
          antenna: n % 6 === 4,
          cool: n % 3 === 1,
          mural: false,
        });
        n++;
      }
    }
    // corner buildings on the cross street, facing the camera
    building(-24, -15.5, 11, 9, 5, {
      rot: 0,
      wall: 3,
      bays: 3,
      sign: signTex("CORTE PALMA MERCANTILE", "#2a2622", "#f0e0c8", { w: 640, h: 116, size: 42 }),
      awning: 2,
      lit: 0.4,
      hvac: true,
      tank: true,
      mural: true,
    });
    building(25, -16.5, 12, 9, 4, {
      rot: 0,
      wall: 5,
      bays: 3,
      sign: signTex("SHIFT DEPOT", "#1c2830", "#c8e0f0", { w: 512, h: 116, size: 50 }),
      escape: true,
      lit: 0.34,
      hvac: true,
      antenna: true,
    });
    building(-26, 16, 10.5, 9, 3, { rot: Math.PI, wall: 1, bays: 2, lit: 0.2 });
    building(27, 17, 10, 9, 4, { rot: Math.PI, wall: 6, bays: 3, lit: 0.24, tank: true });
  }

  // ---------------------------------------------------------------- palms
  function frondGeo(len, wide) {
    return cached(`fr${len.toFixed(2)}${wide.toFixed(2)}`, () => {
      const s = new THREE.Shape();
      const leaflets = 15;
      s.moveTo(0, 0);
      for (let i = 0; i <= leaflets; i++) {
        const t = i / leaflets;
        const x = t * len;
        const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * wide * (1 - t * 0.35);
        s.lineTo(x, w);
        s.lineTo(x + len / leaflets * 0.55, w * 0.55);
      }
      s.lineTo(len, 0.012);
      for (let i = leaflets; i >= 0; i--) {
        const t = i / leaflets;
        const x = t * len;
        const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * wide * (1 - t * 0.35);
        s.lineTo(x + len / leaflets * 0.55, -w * 0.55);
        s.lineTo(x, -w);
      }
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 3 });
      // bend the frond into a droop and add a mid-rib fold
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const t = Math.max(0, x / len);
        p.setY(i, y * (1 - t * 0.15) - Math.abs(y) * 0.5);
        p.setZ(i, p.getZ(i) - t * t * len * 0.42);
      }
      g.computeVertexNormals();
      return g;
    });
  }

  function palm(x, z, h, lean, tilt) {
    const g = new THREE.Group();
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const yy = 0.3 + t * h;
      const rad = lerp(0.26, 0.115, smooth(t));
      const bend = Math.pow(t, 1.7) * lean;
      const seg = put(G.cyl12, M.bark, bend, yy, 0, rad, (h / segs) * 1.12, rad, g);
      seg.rotation.z = -lean * 0.16;
      if (i % 2 === 0) {
        put(G.cyl12, M.coconut, bend, yy + 0.05, 0, rad * 1.1, 0.05, rad * 1.1, g).castShadow = false;
      }
    }
    const topX = Math.pow(1, 1.7) * lean;
    const crown = new THREE.Group();
    const count = 13;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.2;
      const droop = 0.34 + rand() * 0.5;
      const len = 2.5 + rand() * 1.1;
      const f = new THREE.Mesh(frondGeo(len, 0.3 + rand() * 0.1), i % 2 ? M.frond : M.frondDark);
      f.rotation.order = "YXZ";
      f.rotation.y = a;
      f.rotation.z = -droop;
      f.castShadow = true;
      f.receiveShadow = true;
      crown.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const f = new THREE.Mesh(frondGeo(1.5, 0.2), M.frondDark);
      f.rotation.order = "YXZ";
      f.rotation.y = a + 0.5;
      f.rotation.z = -1.45;
      crown.add(f);
    }
    // seed cluster + boot
    put(G.sphLo, M.coconut, 0, -0.12, 0.12, 0.2, 0.14, 0.2, crown).castShadow = false;
    for (let i = 0; i < 5; i++) {
      put(G.sphLo, M.coconut, Math.cos(i) * 0.22, -0.2, Math.sin(i) * 0.22, 0.075, 0.075, 0.075, crown).castShadow = false;
    }
    crown.position.set(topX, h + 0.28, 0);
    g.add(crown);
    g.position.set(x, 0, z);
    g.rotation.y = rand() * Math.PI * 2;
    g.rotation.z = tilt || 0;
    scene.add(g);
  }

  function palms() {
    const spots = [
      [-8.9, 8.4, 7.4, 0.5], [-8.9, -12.6, 8.2, 0.4], [-8.9, -26.4, 7.0, 0.6],
      [-8.9, -40.2, 8.6, 0.35], [-8.9, -54.0, 7.6, 0.5],
      [8.9, 9.6, 8.0, -0.45], [8.9, -13.8, 7.2, -0.55], [8.9, -27.6, 8.4, -0.4],
      [8.9, -41.4, 7.4, -0.5], [8.9, -55.2, 8.0, -0.42],
      [-8.9, 20.5, 6.8, 0.4], [8.9, 21.4, 7.2, -0.4],
      [-19.5, 9.2, 6.4, 0.3], [20.5, 9.6, 6.8, -0.3],
      [-20.5, -9.4, 7.0, 0.35], [21.5, -9.8, 6.6, -0.35],
    ];
    for (const [x, z, h, lean] of spots) palm(x, z, h, lean, (rand() - 0.5) * 0.03);
  }

  // ---------------------------------------------------------------- vehicles
  function carPaint(color) {
    return phys({
      color,
      roughness: 0.3,
      metalness: 0.42,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.25,
    });
  }

  const CAR_KINDS = {
    sedan: { len: 4.62, hood: 0.86, deck: 0.9, cabF: 0.42, cabR: -1.32, roof: 1.36, body: 0.86, w: 0.88 },
    wagon: { len: 4.86, hood: 0.84, deck: 1.62, cabF: 0.5, cabR: -1.92, roof: 1.42, body: 0.88, w: 0.9 },
    pickup: { len: 5.06, hood: 0.9, deck: 0.84, cabF: 0.16, cabR: -0.92, roof: 1.44, body: 0.9, w: 0.92 },
    coupe: { len: 4.34, hood: 0.82, deck: 0.82, cabF: 0.3, cabR: -1.08, roof: 1.28, body: 0.82, w: 0.86 },
  };

  function carBody(kind) {
    return cached(`car${kind}`, () => {
      const k = CAR_KINDS[kind];
      const half = k.len / 2;
      const st = [];
      const N = 22;
      const add = (x, halfW, yb, yt, rt, rb) => st.push({ x, pts: sectionPts(halfW, yb, yt, rt, rb, 4) });
      // rear bumper -> rear deck -> cabin base -> hood -> front bumper
      add(-half, k.w * 0.72, 0.3, k.body - 0.16, 0.16, 0.12);
      add(-half + 0.18, k.w * 0.86, 0.24, k.body - 0.04, 0.2, 0.14);
      add(-half + 0.62, k.w * 0.97, 0.2, k.body + 0.02, 0.22, 0.16);
      add(-1.15, k.w, 0.19, k.body + 0.04, 0.2, 0.15);
      add(-0.2, k.w, 0.19, k.body + 0.05, 0.2, 0.15);
      add(0.75, k.w * 0.99, 0.2, k.body + 0.02, 0.2, 0.15);
      add(1.35, k.w * 0.95, 0.21, k.hood + 0.02, 0.22, 0.16);
      add(half - 0.42, k.w * 0.9, 0.23, k.hood - 0.02, 0.24, 0.16);
      add(half - 0.1, k.w * 0.82, 0.27, k.hood - 0.12, 0.2, 0.14);
      add(half, k.w * 0.7, 0.32, k.hood - 0.24, 0.14, 0.12);
      return loft(st);
    });
  }

  function carCabin(kind) {
    return cached(`cab${kind}`, () => {
      const k = CAR_KINDS[kind];
      const st = [];
      const add = (x, halfW, yb, yt, rt) => st.push({ x, pts: sectionPts(halfW, yb, yt, rt, 0.05, 4) });
      // rear glass base -> roof -> windshield base, with tumblehome
      add(k.cabR, k.w * 0.8, k.body - 0.06, k.body + 0.16, 0.12);
      add(k.cabR + 0.34, k.w * 0.79, k.body - 0.04, k.roof - 0.1, 0.2);
      add(k.cabR + 0.8, k.w * 0.77, k.body - 0.02, k.roof, 0.24);
      add(k.cabF - 0.5, k.w * 0.75, k.body - 0.02, k.roof, 0.24);
      add(k.cabF - 0.1, k.w * 0.73, k.body - 0.04, k.roof - 0.08, 0.2);
      add(k.cabF + 0.34, k.w * 0.72, k.body - 0.06, k.body + 0.2, 0.12);
      return loft(st);
    });
  }

  // axle runs along the car's Z (width); sd flips the hub face outboard
  function wheel(parent, x, z, r, sd) {
    const g = new THREE.Group();
    const width = 0.26;
    const tread = put(G.cyl, M.rubber, 0, 0, 0, r, width, r, g);
    tread.rotation.x = Math.PI / 2;
    const shoulder = put(new THREE.TorusGeometry(r * 0.88, r * 0.13, 8, 24), M.rubber, 0, 0, sd * width * 0.4, null, null, null, g);
    shoulder.castShadow = false;
    const face = sd * (width * 0.5 - 0.015);
    const dish = put(G.cyl, M.darkChrome, 0, 0, face, r * 0.66, 0.06, r * 0.66, g);
    dish.rotation.x = Math.PI / 2;
    const cap = put(G.cyl, M.chrome, 0, 0, face + sd * 0.022, r * 0.56, 0.04, r * 0.56, g);
    cap.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const lug = put(G.cyl, M.darkChrome, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, face + sd * 0.04, r * 0.11, 0.03, r * 0.11, g);
      lug.rotation.x = Math.PI / 2;
      lug.castShadow = false;
    }
    const nut = put(G.cyl, M.chrome, 0, 0, face + sd * 0.05, r * 0.15, 0.03, r * 0.15, g);
    nut.rotation.x = Math.PI / 2;
    nut.castShadow = false;
    g.position.set(x, r, z);
    parent.add(g);
  }

  function car(x, z, rot, color, kind, opts = {}) {
    const k = CAR_KINDS[kind];
    const g = new THREE.Group();
    const paint = carPaint(color);
    const half = k.len / 2;

    const body = new THREE.Mesh(carBody(kind), paint);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(carCabin(kind), paint);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    g.add(cabin);

    // glazing
    const wsA = 0.62;
    const ws = put(G.plane, M.carGlass, k.cabF + 0.08, (k.body + k.roof) * 0.5 + 0.04, 0, 1.62, k.w * 1.42, 1, g);
    ws.rotation.set(0, Math.PI / 2, Math.PI / 2 - wsA);
    ws.castShadow = false;
    const rw = put(G.plane, M.carGlass, k.cabR + 0.02, (k.body + k.roof) * 0.5 + 0.04, 0, 1.5, k.w * 1.4, 1, g);
    rw.rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.72);
    rw.castShadow = false;
    for (const s of [-1, 1]) {
      const side = put(G.plane, M.carGlass, (k.cabF + k.cabR) * 0.5 + 0.18, k.body + (k.roof - k.body) * 0.52, s * k.w * 0.755, Math.abs(k.cabF - k.cabR) * 0.72, (k.roof - k.body) * 0.78, 1, g);
      side.rotation.y = s > 0 ? 0 : Math.PI;
      side.castShadow = false;
      // window frame
      put(G.box, M.darkChrome, (k.cabF + k.cabR) * 0.5 + 0.18, k.body + (k.roof - k.body) * 0.9, s * k.w * 0.76, Math.abs(k.cabF - k.cabR) * 0.7, 0.05, 0.04, g).castShadow = false;
      put(G.box, M.darkChrome, (k.cabF + k.cabR) * 0.5 + 0.2, k.body + (k.roof - k.body) * 0.5, s * k.w * 0.76, 0.05, (k.roof - k.body) * 0.8, 0.04, g).castShadow = false;
    }

    // belt line + rocker + door shuts
    for (const s of [-1, 1]) {
      put(G.box, M.darkChrome, 0.1, k.body - 0.04, s * k.w * 0.99, k.len * 0.82, 0.05, 0.03, g).castShadow = false;
      put(G.box, M.black, 0.1, 0.26, s * k.w * 0.96, k.len * 0.8, 0.14, 0.05, g).castShadow = false;
      put(G.box, M.darkChrome, k.cabR + 0.05, (k.body + 0.3) * 0.5, s * k.w * 1.0, 0.028, k.body - 0.32, 0.02, g).castShadow = false;
      put(G.box, M.darkChrome, k.cabF + 0.32, (k.body + 0.3) * 0.5, s * k.w * 1.0, 0.028, k.body - 0.32, 0.02, g).castShadow = false;
      // handle + mirror
      put(rbox(0.24, 0.06, 0.05, 0.02), M.chrome, k.cabR + 0.62, k.body - 0.2, s * k.w * 1.0, null, null, null, g).castShadow = false;
      const arm = put(G.box, M.black, k.cabF + 0.16, k.body + 0.12, s * k.w * 0.86, 0.16, 0.05, 0.14, g);
      arm.castShadow = false;
      put(rbox(0.1, 0.16, 0.24, 0.04), M.darkChrome, k.cabF + 0.2, k.body + 0.14, s * k.w * 1.0, null, null, null, g);
    }

    // front end: grille, lights, bumper
    put(rbox(0.16, 0.26, k.w * 1.3, 0.05), M.black, half - 0.06, k.hood - 0.3, 0, null, null, null, g);
    for (let i = 0; i < 7; i++) {
      put(G.box, M.chrome, half - 0.02, k.hood - 0.3, -k.w * 0.6 + i * (k.w * 0.2), 0.03, 0.2, 0.035, g).castShadow = false;
    }
    put(rbox(0.2, 0.16, k.w * 1.75, 0.06), M.chrome, half - 0.1, 0.42, 0, null, null, null, g);
    put(rbox(0.2, 0.16, k.w * 1.75, 0.06), M.chrome, -half + 0.1, 0.42, 0, null, null, null, g);
    for (const s of [-1, 1]) {
      const hl = put(rbox(0.1, 0.19, 0.36, 0.05), M.headlight, half - 0.04, k.hood - 0.22, s * k.w * 0.66, null, null, null, g);
      hl.castShadow = false;
      put(rbox(0.06, 0.1, 0.2, 0.03), M.lamp, half - 0.02, k.hood - 0.44, s * k.w * 0.5, null, null, null, g).castShadow = false;
      const tl = put(rbox(0.09, 0.2, 0.42, 0.05), M.tail, -half + 0.04, k.deck - 0.2, s * k.w * 0.62, null, null, null, g);
      tl.castShadow = false;
    }
    // plates + badge
    put(G.box, M.frameLight, half - 0.01, 0.56, 0, 0.02, 0.16, 0.5, g).castShadow = false;
    put(G.box, M.frameLight, -half + 0.01, 0.6, 0, 0.02, 0.16, 0.5, g).castShadow = false;

    if (kind === "pickup") {
      // bed walls + tailgate
      put(G.box, paint, -1.6, k.body + 0.16, 0, 1.9, 0.34, k.w * 2, g);
      put(G.box, M.black, -1.6, k.body + 0.1, 0, 1.7, 0.06, k.w * 1.7, g).castShadow = false;
      for (const s of [-1, 1]) {
        put(G.box, paint, -1.6, k.body + 0.3, s * k.w * 0.97, 1.9, 0.14, 0.08, g).castShadow = false;
      }
    }
    if (kind === "wagon") {
      put(rbox(1.5, 0.08, k.w * 1.2, 0.03), M.steelDark, -0.6, k.roof + 0.06, 0, null, null, null, g);
      for (const s of [-1, 1]) {
        put(G.box, M.steelDark, -0.6, k.roof + 0.02, s * k.w * 0.6, 1.6, 0.05, 0.05, g).castShadow = false;
      }
    }

    const wr = 0.335;
    const wz = k.w * 1.0;
    for (const ax of [k.len * 0.3, -k.len * 0.29]) {
      for (const s of [-1, 1]) {
        wheel(g, ax, s * wz, wr, s);
        // thin crease at the body edge reads as a fender eyebrow
        const brow = put(new THREE.TorusGeometry(wr * 1.16, 0.035, 6, 18, Math.PI * 0.9), paint, ax, wr + 0.03, s * (wz - 0.11), null, null, null, g);
        brow.rotation.set(0, Math.PI / 2, 0.05);
        brow.castShadow = false;
      }
    }

    const shade = put(G.plane, M.shade, 0, 0.015, 0, k.len * 1.02, k.w * 2.3, 1, g);
    shade.rotation.x = -Math.PI / 2;
    shade.castShadow = false;
    shade.receiveShadow = false;

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
    return g;
  }

  function cars() {
    const C = [0xb8452c, 0x25313c, 0xd8d2c4, 0x3f6350, 0x8b91a0, 0xc9a445, 0x2f2b29, 0xa8613f, 0x53707f, 0x7d4a5e];
    // near lane heading toward camera (right side of frame)
    car(3.5, 2.6, Math.PI + 0.02, C[0], "sedan");
    car(3.42, -5.4, Math.PI, C[5], "pickup");
    car(3.5, -11.4, Math.PI - 0.01, C[2], "wagon");
    car(3.46, -21.8, Math.PI, C[3], "sedan");
    car(3.5, -33.4, Math.PI, C[8], "coupe");
    car(3.44, -45.6, Math.PI, C[6], "sedan");
    // far lane heading away
    car(-3.5, 12.6, 0.01, C[1], "wagon");
    car(-3.46, 2.4, 0, C[7], "sedan");
    car(-3.5, -8.6, 0, C[9], "coupe");
    car(-3.42, -19.4, 0.01, C[4], "pickup");
    car(-3.5, -30.2, 0, C[0], "sedan");
    car(-3.46, -42.5, 0, C[2], "wagon");
    // parked at the curb
    car(6.05, 16.5, Math.PI, C[4], "sedan");
    car(6.05, -16.2, Math.PI, C[7], "wagon");
    car(6.05, -37.4, Math.PI, C[1], "sedan");
    car(-6.05, -25.5, 0, C[5], "coupe");
    car(-6.05, -47.2, 0, C[3], "pickup");
    // cross street
    car(-16.5, -3.5, -Math.PI / 2, C[2], "sedan");
    car(18.5, 3.5, Math.PI / 2, C[6], "wagon");
    car(-26, 3.5, Math.PI / 2, C[8], "sedan");
  }

  // ---------------------------------------------------------------- bots
  function botTorso(scheme) {
    return cached(`torso${scheme.body}`, () => {
      const pts = [];
      const prof = [
        [0.0, 0.0], [0.15, 0.0], [0.18, 0.06], [0.17, 0.2], [0.145, 0.34],
        [0.155, 0.46], [0.19, 0.56], [0.215, 0.66], [0.2, 0.74], [0.12, 0.79], [0.0, 0.8],
      ];
      for (const [r, y] of prof) pts.push(new THREE.Vector2(Math.max(0.001, r), y));
      return new THREE.LatheGeometry(pts, 20);
    });
  }

  function bot(x, z, rot, scheme, pose) {
    const s = scheme.s || 1;
    const g = new THREE.Group();
    const shell = phys({ color: scheme.body, roughness: 0.34, metalness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 1.05 });
    const joint = phys({ color: scheme.limb, roughness: 0.38, metalness: 0.66, envMapIntensity: 0.9 });
    const soft = mat({ color: scheme.accent || scheme.limb, roughness: 0.72, metalness: 0.1 });
    const visor = mat({ color: scheme.visor, emissive: scheme.visor, emissiveIntensity: 1.7, roughness: 0.2, metalness: 0.3 });

    const walk = pose === "walk";
    const stride = walk ? 1 : 0;

    // hips
    put(rbox(0.3, 0.19, 0.24, 0.07), joint, 0, 0.86 * s, 0, null, null, null, g);
    // torso shell (lathe) + chest plate + back pack
    const torso = new THREE.Mesh(botTorso(scheme), shell);
    torso.position.set(0, 0.9 * s, 0);
    torso.scale.set(s, s, s * 0.82);
    torso.castShadow = true;
    torso.receiveShadow = true;
    g.add(torso);
    put(rbox(0.27, 0.3, 0.13, 0.06), shell, 0, 1.26 * s, 0.1 * s, null, null, null, g);
    put(rbox(0.17, 0.1, 0.04, 0.02), visor, 0, 1.3 * s, 0.17 * s, null, null, null, g).castShadow = false;
    put(rbox(0.2, 0.24, 0.12, 0.05), joint, 0, 1.2 * s, -0.13 * s, null, null, null, g);
    put(G.cyl, joint, 0, 1.47 * s, 0, 0.06 * s, 0.1 * s, 0.06 * s, g);

    // shoulders
    for (const sd of [-1, 1]) {
      put(G.sph, joint, sd * 0.245 * s, 1.4 * s, 0, 0.085 * s, 0.085 * s, 0.085 * s, g);
      put(rbox(0.14, 0.1, 0.2, 0.045), shell, sd * 0.27 * s, 1.46 * s, 0, null, null, null, g);
    }

    // head: rounded box + wraparound visor + antenna
    const head = new THREE.Group();
    put(rbox(0.24, 0.25, 0.24, 0.075), shell, 0, 0, 0, null, null, null, head);
    put(rbox(0.2, 0.13, 0.2, 0.06), joint, 0, -0.11, 0, null, null, null, head);
    const band = put(new THREE.CylinderGeometry(0.125, 0.125, 0.1, 20, 1, false, -0.95, 1.9), visor, 0, 0.015, 0.015, s, s, s * 1.02, head);
    band.castShadow = false;
    const brow = put(new THREE.CylinderGeometry(0.132, 0.132, 0.045, 20, 1, false, -1.0, 2.0), joint, 0, 0.082, 0.015, s, s, s * 1.02, head);
    brow.castShadow = false;
    put(G.cyl, joint, 0.062, 0.15, 0, 0.014, 0.12, 0.014, head);
    put(G.sphLo, visor, 0.062, 0.225, 0, 0.026, 0.026, 0.026, head).castShadow = false;
    for (const sd of [-1, 1]) {
      put(rbox(0.05, 0.1, 0.06, 0.02), joint, sd * 0.13, 0.0, -0.02, null, null, null, head);
    }
    head.position.set(0, 1.58 * s, 0.01 * s);
    head.scale.setScalar(s);
    head.rotation.y = pose === "look" ? 0.42 : pose === "wave" ? -0.22 : pose === "talk" ? 0.3 : 0.05;
    head.rotation.x = pose === "look" ? -0.1 : 0.02;
    g.add(head);

    const arms = [];
    const legs = [];

    function arm(sd, sh, el) {
      const a = new THREE.Group();
      put(G.cyl, shell, 0, -0.13, 0, 0.052, 0.27, 0.052, a);
      put(G.sph, joint, 0, -0.28, 0, 0.055, 0.055, 0.055, a);
      const fore = new THREE.Group();
      put(G.cyl, shell, 0, -0.12, 0, 0.044, 0.25, 0.044, fore);
      put(rbox(0.075, 0.11, 0.07, 0.028), joint, 0, -0.29, 0.012, null, null, null, fore);
      for (let i = 0; i < 3; i++) {
        put(rbox(0.02, 0.075, 0.022, 0.008), joint, -0.022 + i * 0.022, -0.37, 0.02, null, null, null, fore);
      }
      fore.position.set(0, -0.29, 0);
      fore.rotation.x = el;
      a.add(fore);
      a.position.set(sd * 0.245 * s, 1.4 * s, 0);
      a.rotation.order = "ZXY";
      a.rotation.x = sh;
      a.rotation.z = -sd * 0.1;
      a.scale.setScalar(s);
      g.add(a);
      arms.push(a);
      return a;
    }
    if (pose === "wave") {
      arm(1, -2.3, -0.5);
      arm(-1, 0.16, -0.28);
    } else if (pose === "carry") {
      arm(1, -0.42, -1.15);
      arm(-1, -0.42, -1.15);
    } else if (pose === "talk") {
      arm(1, -0.6, -1.0);
      arm(-1, 0.2, -0.35);
    } else if (walk) {
      arm(1, 0.5, -0.34);
      arm(-1, -0.42, -0.5);
    } else {
      arm(1, 0.16, -0.3);
      arm(-1, 0.12, -0.26);
    }

    function leg(sd, hip, knee) {
      const l = new THREE.Group();
      put(G.cyl, joint, 0, 0.0, 0, 0.06, 0.09, 0.06, l);
      put(G.cyl, shell, 0, -0.19, 0, 0.062, 0.36, 0.062, l);
      put(G.sph, joint, 0, -0.4, 0, 0.058, 0.058, 0.058, l);
      const shin = new THREE.Group();
      put(G.cyl, shell, 0, -0.19, 0, 0.052, 0.36, 0.052, shin);
      put(rbox(0.11, 0.075, 0.26, 0.03), joint, 0, -0.4, 0.05, null, null, null, shin);
      put(rbox(0.1, 0.05, 0.1, 0.025), M.black, 0, -0.43, -0.06, null, null, null, shin);
      shin.position.set(0, -0.42, 0);
      shin.rotation.x = knee;
      l.add(shin);
      l.position.set(sd * 0.105 * s, 0.86 * s, 0);
      l.rotation.x = hip;
      l.scale.setScalar(s);
      g.add(l);
      legs.push(l);
      return l;
    }
    if (pose === "sit") {
      leg(1, 1.25, -1.3);
      leg(-1, 1.2, -1.25);
    } else if (walk) {
      leg(1, -0.4 * stride, 0.18);
      leg(-1, 0.34 * stride, -0.42);
    } else {
      leg(1, 0.05, -0.06);
      leg(-1, -0.04, -0.05);
    }

    if (pose === "carry") {
      put(rbox(0.34, 0.26, 0.24, 0.04), soft, 0, 1.02 * s, 0.3 * s, null, null, null, g);
      put(G.box, M.frameLight, 0, 1.15 * s, 0.31 * s, 0.3 * s, 0.03 * s, 0.2 * s, g).castShadow = false;
    }

    const shade = put(G.plane, M.shade, 0, 0.012, 0, 0.52 * s, 0.34 * s, 1, g);
    shade.rotation.x = -Math.PI / 2;
    shade.castShadow = false;

    g.position.set(x, pose === "sit" ? 0.34 * s : 0, z);
    g.rotation.y = rot;
    g.userData.head = head;
    g.userData.arms = arms;
    g.userData.legs = legs;
    g.userData.pose = pose;
    g.userData.s = s;
    scene.add(g);
    return g;
  }

  // Signed mid-pair lookdev family. Five live bots wear these as cream chest plates.
  const STATUS_WORDS = ["Build", "Design", "Trade", "Render", "Plan"];
  const STATUS_BY_SEAT = {
    builder: STATUS_WORDS[0],
    "design-director": STATUS_WORDS[1],
    trader: STATUS_WORDS[2],
    "video-editor": STATUS_WORDS[3],
    intel: STATUS_WORDS[4],
  };

  function creamLabelTexture(text, size) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 192;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f4ead8";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#3a2a20";
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
    ctx.fillStyle = "#2c2118";
    ctx.font = "700 " + size + "px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let draw = text;
    if (ctx.measureText(draw).width > 580) {
      ctx.font = "700 " + Math.max(28, size - 14) + "px ui-sans-serif, system-ui, sans-serif";
    }
    ctx.fillText(draw, c.width / 2, c.height / 2 + 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function creamChestPlate(text, kind) {
    const status = kind === "status";
    const tex = creamLabelTexture(text, status ? 78 : 44);
    const w = status ? 0.40 : 0.34;
    const h = status ? 0.125 : 0.085;
    const g = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: 0.52, metalness: 0.04 })
    );
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, depthTest: true, depthWrite: true })
    );
    face.position.z = 0.012;
    g.add(plate);
    g.add(face);
    // Status sits on upper chest; seat name on the belt so they do not stack as a cloud.
    g.position.set(0, status ? 1.12 : 0.78, 0.16);
    g.userData.liveTag = true;
    g.userData.tagKind = kind;
    g.userData.tagText = text;
    g.userData.tagPriority = status ? 2 : 1;
    return g;
  }

  function bots() {
    const S = [
      { body: 0xd2d8dc, limb: 0x7d858c, visor: 0x54d8ff, s: 1.02 },
      { body: 0xb5703a, limb: 0x6b4a30, visor: 0xffc06a, s: 0.96, accent: 0x8a5a2a },
      { body: 0x39464e, limb: 0x232c32, visor: 0x82ffbe, s: 1.06 },
      { body: 0xe6dfd2, limb: 0xa8a096, visor: 0xff7a96, s: 0.9 },
      { body: 0x466a70, limb: 0x2a4247, visor: 0xf5e690, s: 1.0 },
      { body: 0x8a90a8, limb: 0x565c70, visor: 0x9ed6ff, s: 0.98 },
      { body: 0xcf9c8c, limb: 0x86645c, visor: 0xffd7ab, s: 0.94 },
      { body: 0x2b2f33, limb: 0x191c1f, visor: 0x6effda, s: 1.04 },
      { body: 0xc2b25e, limb: 0x7b6f38, visor: 0xbfefff, s: 1.0 },
    ];
    // right sidewalk, walking toward camera
    bot(8.3, 10.2, Math.PI - 0.25, S[0], "walk");
    bot(9.5, 8.4, Math.PI + 0.2, S[3], "talk");
    bot(8.9, 6.6, Math.PI + 0.05, S[1], "walk");
    bot(9.9, 4.5, -0.5, S[4], "look");
    bot(8.1, 2.2, Math.PI - 0.1, S[7], "carry");
    bot(9.7, -3.6, Math.PI + 0.12, S[2], "walk");
    bot(8.5, -8.4, 0.2, S[5], "stand");
    bot(9.6, -14.5, Math.PI, S[8], "walk");
    bot(8.7, -21.5, 0.3, S[6], "talk");
    bot(9.4, -28.4, Math.PI + 0.1, S[0], "walk");
    bot(8.4, -36.5, 0.15, S[4], "stand");
    // left sidewalk
    bot(-8.6, 7.5, 0.35, S[5], "walk");
    bot(-9.6, 3.4, 2.7, S[2], "stand");
    bot(-8.5, -6.5, 0.15, S[6], "wave");
    bot(-9.5, -13.4, 0.4, S[1], "walk");
    bot(-8.7, -22.6, 2.9, S[3], "talk");
    bot(-9.4, -31.5, 0.2, S[7], "walk");
    bot(-8.5, -41.2, 0.3, S[8], "stand");
    // crossing the cross-street
    bot(6.9, -0.6, Math.PI - 0.3, S[8], "walk");
    bot(-1.2, 7.4, 1.5, S[0], "walk");
    bot(1.4, 7.9, 1.62, S[4], "walk");
    bot(-14.5, 8.6, 1.4, S[2], "walk");
    bot(16.2, -8.4, -1.5, S[6], "walk");
  }

  const SEAT_ROSTER = [
    { id: "428046a8-3dbd-41e4-ba7e-4f5cf4d80d6c", name: "Psilocybot", title: "chief of staff" },
    { id: "554353fc-a630-4c39-98b6-32fd1d47476e", name: "builder", title: "ship code" },
    { id: "37fb62f9-9842-47ad-8329-6cf8210c276d", name: "design-director", title: "visual craft" },
    { id: "79ae6679-0b3e-4c7b-8023-57b6b63d2507", name: "3d-artist", title: "3D craft" },
    { id: "355e2cc9-a558-40cd-942f-06aa180ab425", name: "motion-designer", title: "motion craft" },
    { id: "c36857f2-73fd-4c66-a8d0-7b1981e8bfd0", name: "creative-director", title: "gen-media" },
    { id: "2b424e84-6aa5-41a1-ae85-6ddeed1ecffe", name: "content-crafter", title: "posts" },
    { id: "190ab988-702f-420d-9a48-339e7332034a", name: "community-manager", title: "graph" },
    { id: "28cf2eef-5ac7-4962-8704-ba2c2749f81b", name: "intel", title: "AI news" },
    { id: "7ab80ebd-531f-4893-aaa4-cb6b0691cf02", name: "viral-analyst", title: "creator study" },
    { id: "00cad833-ce81-4e5b-890e-11da024af830", name: "trader", title: "paper markets" },
    { id: "5b16ef3e-db1c-4cd3-b852-9251c21fe010", name: "video-editor", title: "cuts" },
    { id: "d4b1563a-6844-483e-8e32-446c3781183a", name: "audio-engineer", title: "sound" },
  ];

  const liveActors = [];
  const liveMixers = [];
  let lastLiveT = 0;

  function failLive(msg) {
    console.error("[corte-palma /live]", msg);
    window.__STREET_ERROR__ = msg;
    window.__STREET_READY__ = false;
    const el = document.getElementById("fail");
    if (el) {
      el.style.display = "block";
      el.textContent = msg;
    } else {
      document.body.textContent = msg;
    }
  }

  function seatSlug(name) {
    return String(name).toLowerCase();
  }

  function loadGltf(url) {
    return new Promise((resolve, reject) => {
      if (typeof THREE.GLTFLoader !== "function") {
        reject(new Error("THREE.GLTFLoader missing"));
        return;
      }
      const loader = new THREE.GLTFLoader();
      loader.load(url, resolve, undefined, (err) => {
        reject(new Error("GLTF load failed " + url + " " + (err && err.message ? err.message : err)));
      });
    });
  }

  function enableShadows(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  function fitToHeight(object, meters) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    if (size.y < 1e-4) throw new Error("empty avatar bounds");
    object.scale.multiplyScalar(meters / size.y);
    object.updateMatrixWorld(true);
    box.setFromObject(object);
    object.position.y -= box.min.y;
  }

  function fitToLength(object, meters) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z);
    if (span < 1e-4) throw new Error("empty vehicle bounds");
    object.scale.multiplyScalar(meters / span);
    object.updateMatrixWorld(true);
    box.setFromObject(object);
    object.position.y -= box.min.y;
  }

  async function liveSeats() {
    // Phone camera looks down the right sidewalk at ~z=10. Status-tagged
    // seats plus viral (true-red) stay in that wedge; others start farther back.
    const spots = [
      { x: 5.95, z: 11.85, rot: Math.PI - 0.06, pose: "walk", lane: "right" }, // Psilocybot
      { x: 7.05, z: 12.55, rot: Math.PI - 0.04, pose: "stand", lane: "idle" }, // builder / Build
      { x: 8.22, z: 11.40, rot: Math.PI + 0.05, pose: "stand", lane: "idle" }, // design-director / Design
      { x: 9.55, z: 6.35, rot: -0.35, pose: "look", lane: "idle" }, // 3d-artist
      { x: 8.35, z: 3.55, rot: Math.PI - 0.05, pose: "walk", lane: "right" }, // motion-designer
      { x: 8.95, z: 1.15, rot: Math.PI + 0.08, pose: "walk", lane: "right" }, // creative-director
      { x: -8.4, z: 8.2, rot: 0.28, pose: "walk", lane: "left" }, // content-crafter
      { x: -9.2, z: 5.0, rot: 0.15, pose: "walk", lane: "left" }, // community-manager
      { x: 7.42, z: 8.62, rot: Math.PI + 0.02, pose: "stand", lane: "idle" }, // intel / Plan
      { x: 9.28, z: 10.85, rot: Math.PI + 0.12, pose: "walk", lane: "right" }, // viral-analyst (true-red)
      { x: 6.78, z: 10.38, rot: Math.PI - 0.1, pose: "stand", lane: "idle" }, // trader / Trade
      { x: 8.48, z: 9.48, rot: Math.PI + 0.04, pose: "stand", lane: "idle" }, // video-editor / Render (indigo)
      { x: 5.55, z: 9.15, rot: 0.18, pose: "wave", lane: "idle" }, // audio-engineer
    ];
    const loaded = [];
    for (let i = 0; i < SEAT_ROSTER.length; i++) {
      const seat = SEAT_ROSTER[i];
      const spot = spots[i];
      const slug = seatSlug(seat.name);
      const url = "/avatars/" + slug + ".glb";
      let gltf;
      try {
        gltf = await loadGltf(url);
      } catch (err) {
        try {
          gltf = await loadGltf("/kits/" + encodeURIComponent("Tesla optimus.glb"));
        } catch (err2) {
          throw new Error("seat GLB missing for " + slug + " (" + url + ")");
        }
      }
      const g = new THREE.Group();
      const model = gltf.scene;
      fitToHeight(model, 1.7);
      enableShadows(model);
      g.add(model);
      g.position.set(spot.x, 0, spot.z);
      g.rotation.y = spot.rot;
      g.add(creamChestPlate(seat.name, "name"));
      const status = STATUS_BY_SEAT[slug];
      if (status) g.add(creamChestPlate(status, "status"));
      g.userData.seat = seat;
      g.userData.lane = spot.lane;
      g.userData.pose = spot.pose;
      g.userData.phase = i * 0.73;
      g.userData.speed = 0.85 + (i % 4) * 0.12;
      g.userData.kit = true;
      if (gltf.animations && gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
        g.userData.mixer = mixer;
        liveMixers.push(mixer);
      }
      scene.add(g);
      liveActors.push(g);
      loaded.push(url);
    }
    return loaded;
  }

  const KIT_VEHICLES = [
    { url: "/kits/tesla-cybertruck.glb", x: 3.5, z: 2.6, rot: Math.PI + 0.02, len: 5.68 },
    { url: "/kits/tesla_2018_model_3.glb", x: -3.46, z: 2.4, rot: 0, len: 4.69 },
    { url: "/kits/tesla_2018_model_3.glb", x: 3.5, z: -11.4, rot: Math.PI - 0.01, len: 4.69 },
  ];

  async function liveVehicles() {
    const loaded = [];
    for (const slot of KIT_VEHICLES) {
      let gltf;
      try {
        gltf = await loadGltf(slot.url);
      } catch (err) {
        throw new Error("vehicle kit missing: " + slot.url + " (stage kits/tesla-cybertruck.glb and kits/tesla_2018_model_3.glb — no procedural cars)");
      }
      const g = new THREE.Group();
      const model = gltf.scene;
      fitToLength(model, slot.len);
      enableShadows(model);
      g.add(model);
      g.position.set(slot.x, 0, slot.z);
      g.rotation.y = slot.rot;
      scene.add(g);
      loaded.push(slot.url);
    }
    return loaded;
  }

  // ---------------------------------------------------------------- street kit
  function streetKit() {
    function lamp(x, z, flip) {
      const g = new THREE.Group();
      put(G.cyl12, M.pole, 0, 0.22, 0, 0.16, 0.44, 0.16, g);
      put(G.cyl12, M.pole, 0, 3.3, 0, 0.085, 6.2, 0.085, g);
      // curved arm from a torus quarter
      const arm = put(new THREE.TorusGeometry(1.25, 0.055, 8, 16, Math.PI / 2), M.pole, 0, 6.35, 0, null, null, null, g);
      arm.rotation.set(Math.PI / 2, 0, flip ? Math.PI : 0);
      arm.rotation.y = flip ? Math.PI : 0;
      const hx = flip ? -1.25 : 1.25;
      const head = put(rbox(0.66, 0.16, 0.34, 0.06), M.steel, hx, 7.55, 0, null, null, null, g);
      head.castShadow = true;
      put(rbox(0.56, 0.07, 0.26, 0.03), M.lamp, hx, 7.45, 0, null, null, null, g).castShadow = false;
      g.position.set(x, 0, z);
      g.rotation.y = flip ? -0.1 : 0.1;
      scene.add(g);
    }
    lamp(7.55, 13.5, false);
    lamp(7.55, -6.5, false);
    lamp(7.55, -26.5, false);
    lamp(7.55, -46.5, false);
    lamp(-7.55, 3.5, true);
    lamp(-7.55, -16.5, true);
    lamp(-7.55, -36.5, true);
    lamp(-7.55, -56.5, true);

    function signalHead(parent, x, y, z, ry) {
      const h = new THREE.Group();
      put(rbox(0.3, 0.86, 0.26, 0.05), M.steelDark, 0, 0, 0, null, null, null, h);
      const cols = [
        [0.28, mat({ color: 0x8e2a20, emissive: 0x7c1a12, emissiveIntensity: 0.5, roughness: 0.4 })],
        [0.0, mat({ color: 0x8a7420, emissive: 0x6e5a10, emissiveIntensity: 0.4, roughness: 0.4 })],
        [-0.28, mat({ color: 0x2f8a3e, emissive: 0x1f7a2e, emissiveIntensity: 1.0, roughness: 0.4 })],
      ];
      for (const [yy, m] of cols) {
        put(G.cyl, m, 0, yy, 0.14, 0.075, 0.06, 0.075, h).rotation.x = Math.PI / 2;
        const hood = put(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 12, 1, true), M.steelDark, 0, yy + 0.03, 0.2, null, null, null, h);
        hood.rotation.x = Math.PI / 2 - 0.3;
        hood.castShadow = false;
      }
      h.position.set(x, y, z);
      h.rotation.y = ry;
      parent.add(h);
    }
    // signal mast at the near corner
    const mast = new THREE.Group();
    put(G.cyl12, M.pole, 0, 0.3, 0, 0.22, 0.6, 0.22, mast);
    put(G.cyl12, M.pole, 0, 3.1, 0, 0.11, 5.8, 0.11, mast);
    const boom = put(G.cyl12, M.pole, -2.4, 5.7, 0, 0.09, 4.8, 0.09, mast);
    boom.rotation.z = Math.PI / 2;
    put(new THREE.TorusGeometry(0.5, 0.06, 8, 12, Math.PI / 2), M.pole, -0.5, 5.5, 0, null, null, null, mast).rotation.set(Math.PI / 2, 0, Math.PI);
    signalHead(mast, -1.6, 4.9, 0, -0.06);
    signalHead(mast, -3.8, 4.9, 0, -0.06);
    signalHead(mast, 0.02, 3.5, 0.3, 0.4);
    // pedestrian head + sign blades
    put(rbox(0.34, 0.34, 0.22, 0.05), M.steelDark, 0.05, 2.5, 0.34, null, null, null, mast);
    put(rbox(0.26, 0.26, 0.05, 0.03), mat({ color: 0xe4c26a, emissive: 0xd8a83c, emissiveIntensity: 0.7, roughness: 0.4 }), 0.05, 2.5, 0.46, null, null, null, mast).castShadow = false;
    const blade = put(rbox(2.05, 0.44, 0.07, 0.04), mat({ map: signTex("CORTE PALMA", "#2c5f3c", "#f2efe6", { w: 512, h: 112, size: 46, spacing: 3, band: "#e8e2d0" }), roughness: 0.48 }), 0, 6.5, 0.06, null, null, null, mast);
    blade.castShadow = false;
    const blade2 = put(rbox(1.7, 0.44, 0.07, 0.04), mat({ map: signTex("6TH ST", "#2c5f3c", "#f2efe6", { w: 448, h: 112, size: 46, spacing: 3, band: "#e8e2d0" }), roughness: 0.48 }), 0, 5.98, 0.06, null, null, null, mast);
    blade2.rotation.y = Math.PI / 2;
    blade2.castShadow = false;
    mast.position.set(7.9, 0, 8.1);
    mast.rotation.y = -0.12;
    scene.add(mast);

    // utility poles with crossarms, transformers and catenary wires
    function upole(x, z) {
      const g = new THREE.Group();
      put(G.cyl12, M.bark, 0, 4.6, 0, 0.15, 9.2, 0.15, g);
      for (const [yy, len] of [[8.6, 2.4], [7.9, 1.8]]) {
        put(G.box, M.bark, 0, yy, 0, 0.11, 0.11, len, g);
        for (const s of [-1, 1]) {
          put(G.cyl12, M.frameLight, 0, yy + 0.16, (s * len) / 2.6, 0.045, 0.22, 0.045, g).castShadow = false;
        }
      }
      put(G.cyl, M.steel, 0.28, 7.0, 0, 0.24, 0.62, 0.24, g);
      put(G.cyl, M.steelDark, 0.28, 7.36, 0, 0.26, 0.08, 0.26, g);
      g.position.set(x, 0, z);
      scene.add(g);
      return g;
    }
    const poles = [];
    for (const z of [16, 2, -12, -26, -40, -54]) poles.push([-9.9, z]);
    for (const [x, z] of poles) upole(x, z);
    function wire(a, b, sag) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(a[0], a[1], a[2]),
        new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2),
        new THREE.Vector3(b[0], b[1], b[2]),
      ]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.016, 5, false), M.wire);
      m.castShadow = false;
      scene.add(m);
    }
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i];
      const b = poles[i + 1];
      for (const [dy, dz] of [[8.6, -0.9], [8.6, 0.9], [7.9, -0.7], [7.9, 0.7], [7.0, 0]]) {
        wire([a[0], dy, a[1] + dz], [b[0], dy, b[1] + dz], 0.85);
      }
    }
    // a span crossing the street
    wire([-9.9, 8.4, 2], [9.6, 8.2, -1], 1.5);
    wire([-9.9, 7.7, 2], [9.6, 7.6, -1.4], 1.4);

    function hydrant(x, z) {
      const g = new THREE.Group();
      put(G.cyl, M.hydrant, 0, 0.32, 0, 0.15, 0.5, 0.15, g);
      put(G.cyl, M.hydrant, 0, 0.05, 0, 0.21, 0.1, 0.21, g);
      put(G.sph, M.hydrant, 0, 0.6, 0, 0.16, 0.12, 0.16, g);
      put(G.cyl, M.hydrant, 0, 0.7, 0, 0.05, 0.1, 0.05, g);
      for (const s of [-1, 1]) {
        put(G.cyl, M.chrome, s * 0.16, 0.4, 0, 0.05, 0.14, 0.05, g).rotation.z = Math.PI / 2;
      }
      put(G.cyl, M.chrome, 0, 0.44, 0.16, 0.055, 0.12, 0.055, g).rotation.x = Math.PI / 2;
      g.position.set(x, 0, z);
      scene.add(g);
    }
    hydrant(7.45, 4.6);
    hydrant(-7.5, -10.4);
    hydrant(7.45, -30.5);

    function meter(x, z) {
      put(G.cyl12, M.pole, x, 0.55, z, 0.032, 1.1, 0.032);
      put(rbox(0.17, 0.3, 0.13, 0.04), M.steelDark, x, 1.22, z, null, null, null);
      put(rbox(0.11, 0.13, 0.03, 0.02), M.frameLight, x - 0.02, 1.25, z + 0.07, null, null, null).castShadow = false;
    }
    for (const z of [12.5, 10.5, -17.5, -19.5, -38.5]) meter(7.25, z);
    for (const z of [-14.5, -33.5]) meter(-7.3, z);

    function bin(x, z) {
      const g = new THREE.Group();
      const body = put(new THREE.CylinderGeometry(0.26, 0.22, 0.78, 16, 1, true), M.steelDark, 0, 0.39, 0, null, null, null, g);
      body.material.side = THREE.DoubleSide;
      for (let i = 0; i < 10; i++) {
        put(G.box, M.steelDark, 0, 0.39, 0, 0.54, 0.66, 0.03, g).rotation.y = (i / 10) * Math.PI;
      }
      put(new THREE.TorusGeometry(0.27, 0.03, 6, 18), M.steel, 0, 0.79, 0, null, null, null, g).rotation.x = Math.PI / 2;
      put(G.cyl, M.black, 0, 0.72, 0, 0.24, 0.1, 0.24, g);
      g.position.set(x, 0, z);
      scene.add(g);
    }
    bin(7.5, 1.2);
    bin(-7.55, -20.5);
    bin(7.5, -40.5);

    function bench(x, z, ry) {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        put(rbox(1.7, 0.07, 0.13, 0.03), M.bench, 0, 0.44, -0.24 + i * 0.12, null, null, null, g);
      }
      for (let i = 0; i < 4; i++) {
        put(rbox(1.7, 0.11, 0.06, 0.02), M.bench, 0, 0.6 + i * 0.14, -0.3, null, null, null, g);
      }
      for (const s of [-1, 1]) {
        put(G.box, M.steelDark, s * 0.72, 0.22, 0, 0.07, 0.44, 0.5, g);
        put(G.box, M.steelDark, s * 0.72, 0.72, -0.3, 0.06, 0.6, 0.06, g);
        put(G.box, M.steelDark, s * 0.72, 0.55, -0.05, 0.06, 0.06, 0.44, g).castShadow = false;
      }
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      scene.add(g);
    }
    bench(9.4, 12.2, -0.1);
    bench(9.5, -18.5, 0.05);
    bench(-9.5, -28.5, Math.PI);

    function planter(x, z) {
      const g = new THREE.Group();
      put(rbox(1.0, 0.5, 1.0, 0.07), M.plinth, 0, 0.25, 0, null, null, null, g);
      put(rbox(1.08, 0.09, 1.08, 0.04), M.curbTop, 0, 0.52, 0, null, null, null, g);
      put(G.box, M.dirt, 0, 0.5, 0, 0.86, 0.08, 0.86, g).castShadow = false;
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2;
        const rr = rand() * 0.3;
        put(G.sphLo, M.hedge, Math.cos(a) * rr, 0.6 + rand() * 0.22, Math.sin(a) * rr, 0.2 + rand() * 0.12, 0.18 + rand() * 0.1, 0.2 + rand() * 0.12, g);
      }
      g.position.set(x, 0, z);
      scene.add(g);
    }
    planter(9.7, 6.0);
    planter(9.7, -11.5);
    planter(-9.75, 0.5);
    planter(-9.75, -25.0);
    planter(9.7, -33.0);

    function bollard(x, z) {
      put(G.cyl12, M.steelDark, x, 0.34, z, 0.075, 0.68, 0.075);
      put(G.sphLo, M.steelDark, x, 0.7, z, 0.08, 0.06, 0.08);
    }
    for (let i = 0; i < 4; i++) bollard(7.35, -1.2 - i * 0.9);

    // newspaper boxes + mailbox at the corner
    for (let i = 0; i < 3; i++) {
      const col = [0x2f5f7a, 0x7a3a3a, 0x3a6a4a][i];
      const g = new THREE.Group();
      put(rbox(0.42, 0.8, 0.36, 0.05), mat({ color: col, roughness: 0.55, metalness: 0.2 }), 0, 0.72, 0, null, null, null, g);
      put(rbox(0.3, 0.26, 0.03, 0.02), M.glass, 0, 0.92, 0.19, null, null, null, g).castShadow = false;
      put(G.cyl12, M.steelDark, 0, 0.16, 0, 0.05, 0.34, 0.05, g);
      g.position.set(9.9, 0, -6.0 + i * 0.5);
      g.rotation.y = -0.2;
      scene.add(g);
    }
    const mailbox = new THREE.Group();
    const mbMat = mat({ color: 0x3a4a6a, roughness: 0.5, metalness: 0.3 });
    put(rbox(0.58, 0.9, 0.48, 0.2), mbMat, 0, 1.06, 0, null, null, null, mailbox);
    put(rbox(0.5, 0.2, 0.06, 0.03), M.steelDark, 0, 1.16, 0.24, null, null, null, mailbox).castShadow = false;
    put(G.box, M.steelDark, 0, 0.32, 0, 0.46, 0.62, 0.38, mailbox);
    mailbox.position.set(10.0, 0, 17.6);
    mailbox.rotation.y = -0.3;
    scene.add(mailbox);

    // bike rack + bikes suggestion
    for (let i = 0; i < 2; i++) {
      const rack = put(new THREE.TorusGeometry(0.36, 0.035, 6, 14, Math.PI), M.steel, -9.6, 0.36, -4 - i * 1.2, null, null, null);
      rack.rotation.y = Math.PI / 2;
    }

    // cafe tables outside the corner shop
    for (let i = 0; i < 3; i++) {
      const tx = 9.9;
      const tz = 3.2 - i * 1.55;
      put(G.cyl12, M.steelDark, tx, 0.36, tz, 0.04, 0.72, 0.04);
      put(G.cyl, M.frameLight, tx, 0.73, tz, 0.34, 0.05, 0.34);
      put(G.cyl12, M.steelDark, tx, 0.04, tz, 0.16, 0.06, 0.16);
      for (const s of [-1, 1]) {
        const ch = new THREE.Group();
        put(rbox(0.34, 0.05, 0.34, 0.03), M.bench, 0, 0.42, 0, null, null, null, ch);
        put(rbox(0.34, 0.36, 0.05, 0.03), M.bench, 0, 0.6, -0.16, null, null, null, ch);
        for (const [ox, oz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
          put(G.cyl12, M.steelDark, ox, 0.21, oz, 0.018, 0.42, 0.018, ch);
        }
        ch.position.set(tx + s * 0.62, 0, tz);
        ch.rotation.y = s > 0 ? -1.4 : 1.4;
        scene.add(ch);
      }
    }

    // A-frame sidewalk sign
    const aframe = new THREE.Group();
    const aTex = signTex("FRESH", "#2a2a2c", "#f0d69a", { w: 256, h: 320, size: 46, sub: "COFFEE / 7A" });
    for (const s of [-1, 1]) {
      const p = put(rbox(0.62, 0.9, 0.05, 0.03), mat({ map: aTex, roughness: 0.5 }), 0, 0.5, s * 0.16, null, null, null, aframe);
      p.rotation.x = s * 0.2;
    }
    aframe.position.set(8.5, 0, 4.9);
    aframe.rotation.y = -0.5;
    scene.add(aframe);
  }

  // ---------------------------------------------------------------- backdrop
  function backdrop() {
    const ridge = (x, y, z, sx, sy, sz, m, rot) => {
      const o = put(G.sph, m, x, y, z, sx, sy, sz);
      o.castShadow = false;
      o.receiveShadow = false;
      o.rotation.y = rot || 0;
      return o;
    };
    ridge(-52, -6, -150, 92, 34, 46, M.hillNear, 0.3);
    ridge(30, -8, -168, 120, 42, 52, M.hillMid, -0.2);
    ridge(-130, -10, -140, 100, 38, 44, M.hillMid, 0.1);
    ridge(120, -12, -180, 140, 48, 60, M.hillFar, 0.4);
    ridge(-10, -14, -230, 220, 56, 70, M.hillFar, 0);
    // far skyline blocks down the street corridor
    const r = seed(0x9911);
    for (let i = 0; i < 46; i++) {
      const x = -60 + i * 2.7 + r() * 1.4;
      if (Math.abs(x) < 5 && r() > 0.4) continue;
      const h = 11 + r() * 30;
      const w = 3.8 + r() * 6;
      const z = -108 - r() * 44;
      const b = put(G.box, M.farBlock, x, h / 2, z, w, h, w * 0.9);
      b.castShadow = false;
      b.receiveShadow = false;
    }
    // haze planes to separate depth layers
    for (let i = 0; i < 4; i++) {
      const p = put(
        G.plane,
        mat({ color: 0xe8b389, transparent: true, opacity: 0.13 - i * 0.022, depthWrite: false }),
        0,
        20,
        -84 - i * 22,
        360,
        90,
        1
      );
      p.castShadow = false;
      p.receiveShadow = false;
    }
  }

  // ---------------------------------------------------------------- overlay
  const overlayScene = new THREE.Scene();
  const overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  overlayScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { res: { value: new THREE.Vector2(W, H) } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: [
          "varying vec2 vUv; uniform vec2 res;",
          "float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
          "void main(){",
          "  vec2 d = vUv - 0.5;",
          "  float v = smoothstep(0.86, 0.28, length(d * vec2(1.12, 1.0)));",
          "  float vig = mix(0.30, 0.0, v);",
          "  float g = (h21(vUv * res) - 0.5) * 0.045;",
          "  float warm = smoothstep(0.55, 0.0, length(d)) * 0.05;",
          "  vec3 c = vec3(0.06, 0.03, 0.02) * vig * 6.0;",
          "  gl_FragColor = vec4(c - vec3(warm * 0.4, warm * 0.2, -warm * 0.3) + g, clamp(vig * 1.9 + abs(g) * 3.0, 0.0, 0.86));",
          "}",
        ].join("\n"),
      })
    )
  );

  // ---------------------------------------------------------------- build
  backdrop();
  ground();
  blocks();
  palms();
  if (!LIVE) cars();
  if (!LIVE) bots();
  streetKit();

  function renderFrame() {
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(overlayScene, overlayCam);
  }

  function fitLive() {
    const w = Math.max(320, window.innerWidth || 390);
    const h = Math.max(240, window.innerHeight || 844);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    overlayScene.children[0].material.uniforms.res.value.set(w, h);
  }

  const _tagNdc = new THREE.Vector3();
  function cullLiveTags() {
    const tagged = [];
    for (const actor of liveActors) {
      actor.traverse((o) => {
        if (!o.userData.liveTag) return;
        o.visible = true;
        o.getWorldPosition(_tagNdc);
        _tagNdc.project(camera);
        tagged.push({
          o,
          x: _tagNdc.x,
          y: _tagNdc.y,
          z: _tagNdc.z,
          prio: o.userData.tagPriority || 1,
        });
      });
    }
    tagged.sort((a, b) => a.z - b.z || b.prio - a.prio);
    const kept = [];
    for (const t of tagged) {
      if (t.z < -1 || t.z > 1 || t.x < -1.15 || t.x > 1.15 || t.y < -1.2 || t.y > 1.15) {
        t.o.visible = false;
        continue;
      }
      let hide = false;
      for (const k of kept) {
        const dx = t.x - k.x;
        const dy = t.y - k.y;
        if (dx * dx + dy * dy < 0.028) {
          if (t.prio < k.prio) {
            t.o.visible = false;
            hide = true;
            break;
          }
          if (t.prio === k.prio && t.z > k.z) {
            t.o.visible = false;
            hide = true;
            break;
          }
          k.o.visible = false;
        }
      }
      if (!hide) kept.push(t);
    }
  }

  function tickLive(now) {
    const t = now * 0.001;
    const dt = lastLiveT ? Math.min(0.05, t - lastLiveT) : 0.016;
    lastLiveT = t;
    for (const mixer of liveMixers) mixer.update(dt);
    for (const g of liveActors) {
      const pose = g.userData.pose;
      const phase = g.userData.phase || 0;
      const bob = Math.abs(Math.sin(t * 6.2 + phase)) * 0.03;
      if (pose === "walk") {
        if (!g.userData.mixer) g.position.y = bob;
        if (g.userData.lane === "right") {
          g.position.z -= g.userData.speed * 0.018;
          if (g.position.z < -8) g.position.z = 12.2;
        } else if (g.userData.lane === "left") {
          g.position.z += g.userData.speed * 0.018;
          if (g.position.z > 12.2) g.position.z = -6;
        } else if (g.userData.lane === "cross") {
          g.position.x += g.userData.speed * 0.016;
          if (g.position.x > 8.5) g.position.x = -6.5;
        }
      } else {
        g.rotation.y += Math.sin(t * 1.1 + phase) * 0.002;
      }
    }
    cullLiveTags();
    renderFrame();
    window.__STREET_LIVE_T__ = t;
    requestAnimationFrame(tickLive);
  }

  function readStats() {
    const gl = renderer.getContext();
    const pix = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    let sum = 0;
    let sum2 = 0;
    let n = 0;
    const colors = new Set();
    for (let i = 0; i < pix.length; i += 16) {
      const r = pix[i];
      const g = pix[i + 1];
      const b = pix[i + 2];
      sum += r + g + b;
      sum2 += r * r + g * g + b * b;
      n += 3;
      colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
    const mean = sum / n;
    const variance = sum2 / n - mean * mean;
    return { variance, colors: colors.size, mean, w: W, h: H };
  }

  function publish() {
    const stats = readStats();
    window.__STREET_STATS__ = stats;
    if (stats.variance < 400 || stats.colors < 40) {
      window.__STREET_ERROR__ = `flat WebGL frame var=${stats.variance.toFixed(1)} colors=${stats.colors}`;
      return;
    }
    window.__STREET_PNG__ = renderer.domElement.toDataURL("image/png");
    document.documentElement.dataset.ready = "1";
    window.__STREET_READY__ = true;
  }

  function settle(left) {
    renderFrame();
    if (left > 0) {
      requestAnimationFrame(() => settle(left - 1));
      return;
    }
    try {
      publish();
    } catch (err) {
      window.__STREET_ERROR__ = String(err && err.message ? err.message : err);
    }
  }
  if (LIVE) {
    fitLive();
    window.addEventListener("resize", fitLive);
    (async () => {
      try {
        const avatars = await liveSeats();
        const carsLoaded = await liveVehicles();
        window.__STREET_STATS__ = { live: true, seats: SEAT_ROSTER.map((s) => s.name), avatars, cars: carsLoaded };
        window.__STREET_READY__ = true;
        document.documentElement.dataset.ready = "1";
        requestAnimationFrame(tickLive);
      } catch (err) {
        failLive(String(err && err.message ? err.message : err));
      }
    })();
  } else {
    settle(6);
  }
})();
