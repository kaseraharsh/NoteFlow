document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. THREE.JS 3D ORBITAL SCENE WITH CAMERA PAGE CHOREOGRAPHY
  // ==========================================================================
  let orbitalController = initOrbitalThreeScene();

  function initOrbitalThreeScene() {
    const canvas = document.getElementById('orbitalCanvas');
    if (!canvas || typeof THREE === 'undefined') return null;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1.1 Particle Sphere with Mathematical Wave Distortion
    const radius = 2.4;
    const particleCount = 12000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorBright = new THREE.Color(0xa78bfa); // Violet
    const colorMid = new THREE.Color(0x38bdf8);    // Cyan
    const colorDim = new THREE.Color(0x4c1d95);    // Deep Purple

    let validIndex = 0;
    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      const noise = Math.sin(x * 3.2) * Math.cos(y * 3.2) * Math.sin(z * 3.2) + Math.cos(x * 5) * 0.35;
      if (noise <= -0.15) continue;

      const distortion = 1 + noise * 0.12;
      positions[validIndex * 3] = x * distortion;
      positions[validIndex * 3 + 1] = y * distortion;
      positions[validIndex * 3 + 2] = z * distortion;

      const mixedColor = colorDim.clone().lerp(noise > 0.4 ? colorBright : colorMid, noise * 0.8 + 0.2);
      colors[validIndex * 3] = mixedColor.r;
      colors[validIndex * 3 + 1] = mixedColor.g;
      colors[validIndex * 3 + 2] = mixedColor.b;
      validIndex++;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, validIndex * 3), 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, validIndex * 3), 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.024,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const spherePoints = new THREE.Points(particleGeometry, particleMaterial);
    mainGroup.add(spherePoints);

    // 1.2 Concentric Glowing Orbital Rings & Nodes
    const ringsGroup = new THREE.Group();
    mainGroup.add(ringsGroup);

    const ringCount = 5;
    const ringNodes = [];
    const ringLines = [];

    for (let r = 0; r < ringCount; r++) {
      const ringRadius = radius * (1.15 + r * 0.24);
      const points = [];
      const segments = 120;

      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0));
      }

      const ringGeom = new THREE.BufferGeometry().setFromPoints(points);
      const ringMat = new THREE.LineBasicMaterial({
        color: r % 2 === 0 ? 0x8b5cf6 : 0x38bdf8,
        transparent: true,
        opacity: 0.25 - r * 0.03,
        blending: THREE.AdditiveBlending
      });

      const ringLine = new THREE.Line(ringGeom, ringMat);
      const baseRotX = Math.PI * (0.35 + r * 0.12);
      const baseRotY = Math.PI * (0.15 * r);
      ringLine.rotation.x = baseRotX;
      ringLine.rotation.y = baseRotY;
      ringLine.userData = { baseRotX, baseRotY, index: r };
      ringsGroup.add(ringLine);
      ringLines.push(ringLine);

      const nodeGeom = new THREE.SphereGeometry(0.04, 12, 12);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const nodeMesh = new THREE.Mesh(nodeGeom, nodeMat);
      ringsGroup.add(nodeMesh);

      ringNodes.push({
        mesh: nodeMesh,
        radius: ringRadius,
        baseSpeed: 0.004 * (r % 2 === 0 ? 1 : -1) * (1 - r * 0.1),
        angle: Math.random() * Math.PI * 2,
        rotX: baseRotX,
        rotY: baseRotY
      });
    }

    // 1.3 Ambient Cosmic Starfield
    const starCount = 800;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 30;
      starPositions[i + 1] = (Math.random() - 0.5) * 20;
      starPositions[i + 2] = (Math.random() - 0.5) * 20;
    }

    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.02,
      transparent: true,
      opacity: 0.45
    });
    const starfield = new THREE.Points(starGeom, starMat);
    scene.add(starfield);

    // Mouse, Cursor Velocity & Interactive Drag Tracking
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let scrollVelocity = 0;
    let lastScrollY = window.scrollY;

    let lastMouseTime = performance.now();
    let lastClientX = window.innerWidth * 0.65;
    let lastClientY = window.innerHeight * 0.5;
    let mouseVelX = 0;
    let mouseVelY = 0;
    let cursorSpeed = 0;
    let isPointerDragging = false;
    let isOverAnimationArea = false;

    window.addEventListener('mousemove', (e) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      mouseX = (e.clientX - halfW) / halfW;
      mouseY = (e.clientY - halfH) / halfH;

      const now = performance.now();
      const dt = Math.max(8, now - lastMouseTime);
      lastMouseTime = now;

      const dx = e.clientX - lastClientX;
      const dy = e.clientY - lastClientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      // Detect if cursor is near or over the 3D globe / rings animation (right side on overview page)
      isOverAnimationArea = (currentPageId === 'page-overview' && e.clientX > window.innerWidth * 0.35);

      // Higher sensitivity and responsiveness when interacting with the 3D animation
      const sensitivity = isOverAnimationArea ? 2.4 : 1.2;

      // Instantaneous cursor momentum
      const instantVx = (dx / dt) * 0.003 * sensitivity;
      const instantVy = (dy / dt) * 0.003 * sensitivity;

      mouseVelX += instantVx;
      mouseVelY += instantVy;

      // If user is clicking and dragging over the animation, rotate directly
      if (isPointerDragging) {
        mainGroup.rotation.y += dx * 0.007;
        mainGroup.rotation.x += dy * 0.007;
      }

      // Clamp max velocity to prevent uncontrolled spinning
      const maxVel = 0.075;
      mouseVelX = Math.max(-maxVel, Math.min(maxVel, mouseVelX));
      mouseVelY = Math.max(-maxVel, Math.min(maxVel, mouseVelY));
    });

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, input, a, textarea, .dock-navigation, .lang-switch-capsule')) return;
      isPointerDragging = true;
    });

    window.addEventListener('mouseup', () => {
      isPointerDragging = false;
    });

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      scrollVelocity = (currentScrollY - lastScrollY) * 0.005;
      lastScrollY = currentScrollY;
    }, { passive: true });

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      cameraPageTargets['page-overview'] = getOverviewTarget();
      if (activeTarget === cameraPageTargets['page-overview']) {
        activeTarget = cameraPageTargets['page-overview'];
      }
    }
    window.addEventListener('resize', onWindowResize);

    function getOverviewTarget() {
      const isMobile = window.innerWidth < 850;
      return isMobile
        ? { camX: 0, camY: 0.6, camZ: 8.5, groupRotX: 0.1, speed: 0.0028 }
        : { camX: -1.95, camY: 0, camZ: 7.2, groupRotX: 0.08, speed: 0.0028 };
    }

    // Camera Page Choreography Target Definitions
    const cameraPageTargets = {
      'page-overview':    getOverviewTarget(),
      'page-synthesizer': { camX: 0,    camY: 0.35, camZ: 6.4, groupRotX: 0.35, speed: 0.004 },
      'page-notes':       { camX: 1.5,  camY: -0.2, camZ: 8.6, groupRotX: 0.15, speed: 0.0015 },
      'page-telemetry':   { camX: 0,    camY: -0.4, camZ: 6.8, groupRotX: 0.75, speed: 0.005 },
      'page-config':      { camX: -1.2, camY: 0.2,  camZ: 7.2, groupRotX: -0.2, speed: 0.002 }
    };

    let activeTarget = cameraPageTargets['page-overview'];
    let warpImpulse = 0;
    let isWarping = false;

    // Animation Loop
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      // Smooth Camera & Group Lerp to Page Targets (with Globe Dive-In warp physics)
      if (warpImpulse > 0.005) {
        // Deep camera plunge through the concentric rings into the particle globe core
        camera.position.z += (activeTarget.camZ - camera.position.z) * (0.05 + warpImpulse * 0.045);
        camera.position.x += (activeTarget.camX - camera.position.x) * (0.06 + warpImpulse * 0.04);
        camera.position.y += (activeTarget.camY - camera.position.y) * (0.06 + warpImpulse * 0.04);

        // Concentric rings expand and whoosh past the viewport
        ringsGroup.scale.setScalar(1 + warpImpulse * 0.7);
        particleMaterial.size = 0.024 + warpImpulse * 0.025;

        // Dynamic forward warp rotation
        mainGroup.rotation.y += warpImpulse * 0.05;
        mainGroup.rotation.x += warpImpulse * 0.015;

        warpImpulse *= 0.915;
        if (warpImpulse <= 0.005) {
          warpImpulse = 0;
          isWarping = false;
          ringsGroup.scale.setScalar(1);
          particleMaterial.size = 0.024;
        }
      } else {
        camera.position.x += (activeTarget.camX - camera.position.x) * 0.05;
        camera.position.y += (activeTarget.camY - camera.position.y) * 0.05;
        camera.position.z += (activeTarget.camZ - camera.position.z) * 0.05;
      }

      // Mouse Parallax Lerp
      targetX += (mouseX * 0.5 - targetX) * 0.06;
      targetY += (mouseY * 0.5 - targetY) * 0.06;

      // Current cursor movement speed
      cursorSpeed = Math.hypot(mouseVelX, mouseVelY);

      // GLOBE ROTATION SPEED DEPENDS PROPORTIONALLY ON MOUSE CURSOR VELOCITY
      // Moving cursor horizontally accelerates globe rotation in that direction
      const dynamicSpeed = activeTarget.speed + mouseVelX * 1.8;
      mainGroup.rotation.y += dynamicSpeed + scrollVelocity;
      mainGroup.rotation.x += ((activeTarget.groupRotX + targetY * 0.45 + mouseVelY * 2.2) - mainGroup.rotation.x) * 0.07;
      mainGroup.rotation.z += ((targetX * 0.35 + mouseVelX * 1.5) - mainGroup.rotation.z) * 0.07;

      // Gentle friction decay so movement smoothly returns to natural orbital drift
      mouseVelX *= 0.93;
      mouseVelY *= 0.93;
      scrollVelocity *= 0.94;

      // PEECHE WALA CIRCLE (Background concentric orbital rings):
      // The background rings tilt, sway, and rotate synchronously with cursor movement!
      ringsGroup.rotation.x += ((targetY * 0.7 + mouseVelY * 3.6) - ringsGroup.rotation.x) * 0.08;
      ringsGroup.rotation.y += ((targetX * 0.7 + mouseVelX * 3.6) - ringsGroup.rotation.y) * 0.08;
      ringsGroup.rotation.z += (mouseVelX * 1.8 - ringsGroup.rotation.z) * 0.06;

      // Each individual concentric ring tilts and rotates with dynamic cursor momentum
      ringLines.forEach((ring, idx) => {
        const factor = 1 + idx * 0.3;
        const dir = idx % 2 === 0 ? 1 : -1;
        ring.rotation.z += (0.0012 * dir + mouseVelX * 0.85 * factor);
        ring.rotation.x = ring.userData.baseRotX + targetY * 0.32 * factor + mouseVelY * 1.4;
        ring.rotation.y = ring.userData.baseRotY + targetX * 0.32 * factor + mouseVelX * 1.4;
      });

      // Orbiting satellite nodes accelerate dynamically with cursor speed
      ringNodes.forEach(node => {
        const speedBoost = 1 + cursorSpeed * 20;
        node.angle += node.baseSpeed * speedBoost;
        const lx = Math.cos(node.angle) * node.radius;
        const ly = Math.sin(node.angle) * node.radius;
        const vec = new THREE.Vector3(lx, ly, 0);
        vec.applyAxisAngle(new THREE.Vector3(1, 0, 0), node.rotX);
        vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), node.rotY);
        node.mesh.position.copy(vec);
      });

      starfield.rotation.y += 0.0003;
      renderer.render(scene, camera);
    }

    animate();

    return {
      setPageTarget: (pageId) => {
        if (pageId === 'page-overview') {
          cameraPageTargets['page-overview'] = getOverviewTarget();
        }
        if (cameraPageTargets[pageId]) {
          activeTarget = cameraPageTargets[pageId];
        }
      },
      triggerDiveIn: (pageId) => {
        if (pageId === 'page-overview') {
          cameraPageTargets['page-overview'] = getOverviewTarget();
        }
        if (cameraPageTargets[pageId]) {
          activeTarget = cameraPageTargets[pageId];
        }
        warpImpulse = 1.0;
        isWarping = true;
        // Plunge camera inward towards the globe's glowing core
        camera.position.z = Math.min(camera.position.z, 2.6);
      }
    };
  }

  // ==========================================================================
  // 2. MULTI-PAGE NAVIGATOR & ANIMATED TOP DOCK
  // ==========================================================================
  const dockTrack = document.getElementById('dockTrack');
  const dockSlidingPill = document.getElementById('dockSlidingPill');
  const dockTabBtns = document.querySelectorAll('.dock-tab-btn');
  const pageViews = document.querySelectorAll('.page-view');

  let currentPageId = 'page-overview';

  function updateSlidingPill(activeBtn) {
    if (!activeBtn || !dockSlidingPill) return;
    const left = activeBtn.offsetLeft;
    const width = activeBtn.offsetWidth;
    dockSlidingPill.style.left = `${left}px`;
    dockSlidingPill.style.width = `${width}px`;
  }

  const pageSequence = [
    'page-overview',
    'page-synthesizer',
    'page-notes',
    'page-telemetry',
    'page-config'
  ];

  function navigateToPage(targetPageId) {
    if (currentPageId === targetPageId) return;

    const oldPage = document.getElementById(currentPageId);
    const newPage = document.getElementById(targetPageId);
    if (!newPage) return;

    // 1. Exit animation on old page
    if (oldPage) {
      oldPage.classList.remove('active');
      oldPage.classList.add('page-exit');
      setTimeout(() => {
        oldPage.classList.remove('page-exit');
      }, 260);
    }

    // 2. Trigger 3D Globe Dive-In Warp Transition!
    if (orbitalController && orbitalController.triggerDiveIn) {
      orbitalController.triggerDiveIn(targetPageId);
    }

    // 3. Enter animation on new page (Content cascade will execute: heading -> functions -> widgets)
    newPage.classList.add('active');
    currentPageId = targetPageId;

    // 4. Update dock tab active state and sliding pill
    dockTabBtns.forEach(btn => {
      if (btn.getAttribute('data-target') === targetPageId) {
        btn.classList.add('active');
        updateSlidingPill(btn);
      } else {
        btn.classList.remove('active');
      }
    });

    // 5. Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Attach click listeners to dock buttons
  dockTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      navigateToPage(targetId);
    });
  });

  // Page Launch Button Interconnects
  const overviewLaunchBtn = document.getElementById('overviewLaunchBtn');
  if (overviewLaunchBtn) {
    overviewLaunchBtn.addEventListener('click', () => navigateToPage('page-synthesizer'));
  }

  // All Bottom Telemetry Bar Buttons (Pages 1-5)
  const bottomBarNavMap = [
    { id: 'overviewScrollBtn', target: 'page-synthesizer' },
    { id: 'synthesizerScrollBtn', target: 'page-notes' },
    { id: 'notesScrollBtn', target: 'page-telemetry' },
    { id: 'telemetryScrollBtn', target: 'page-config' },
    { id: 'configBackToTopBtn', target: 'page-overview' }
  ];

  bottomBarNavMap.forEach(({ id, target }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => navigateToPage(target));
    }
  });

  // Universal Mouse Wheel Page-by-Page Scrolling with Cooldown
  let isScrollNavigating = false;
  window.addEventListener('wheel', (e) => {
    if (isScrollNavigating) return;

    // Ignore scroll inside user inputs, textareas, or scrollable transcripts
    if (e.target.closest('#manualTextInput, #editNotesArea, #notesDocument, .transcript-stream-list')) return;

    const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 55);
    const atTop = window.scrollY <= 10;

    if (e.deltaY > 45) {
      // Scroll down: on single-view cover page or when user hits bottom of current page
      if (currentPageId === 'page-overview' || atBottom) {
        isScrollNavigating = true;
        const currentIdx = pageSequence.indexOf(currentPageId);
        const nextId = (currentIdx === pageSequence.length - 1) ? 'page-overview' : pageSequence[currentIdx + 1];
        navigateToPage(nextId);
        setTimeout(() => { isScrollNavigating = false; }, 950);
      }
    } else if (e.deltaY < -45 && atTop) {
      // Scroll up: when at the top of a page, return to previous page
      const currentIdx = pageSequence.indexOf(currentPageId);
      if (currentIdx > 0) {
        isScrollNavigating = true;
        const prevId = pageSequence[currentIdx - 1];
        navigateToPage(prevId);
        setTimeout(() => { isScrollNavigating = false; }, 950);
      }
    }
  }, { passive: true });

  const headerSynthesizerBtn = document.getElementById('headerSynthesizerBtn');
  if (headerSynthesizerBtn) {
    headerSynthesizerBtn.addEventListener('click', () => navigateToPage('page-synthesizer'));
  }

  const overviewTelemetryBtn = document.getElementById('overviewTelemetryBtn');
  if (overviewTelemetryBtn) {
    overviewTelemetryBtn.addEventListener('click', () => navigateToPage('page-telemetry'));
  }

  const brandHomeBtn = document.getElementById('brandHomeBtn');
  if (brandHomeBtn) {
    brandHomeBtn.addEventListener('click', () => navigateToPage('page-overview'));
  }

  const emptyStateLaunchBtn = document.getElementById('emptyStateLaunchBtn');
  if (emptyStateLaunchBtn) {
    emptyStateLaunchBtn.addEventListener('click', () => navigateToPage('page-synthesizer'));
  }

  // Initial Page & Pill positioning (Synchronous for instant render)
  if (window.location.hash) {
    const hashTarget = window.location.hash.replace('#', '');
    if (document.getElementById(hashTarget)) {
      navigateToPage(hashTarget);
    }
  }

  const initialActive = document.querySelector('.dock-tab-btn.active');
  updateSlidingPill(initialActive);
  setTimeout(() => {
    const active = document.querySelector('.dock-tab-btn.active');
    updateSlidingPill(active);
  }, 120);

  window.addEventListener('resize', () => {
    const active = document.querySelector('.dock-tab-btn.active');
    updateSlidingPill(active);
  });

  // ==========================================================================
  // 3. I18N BILINGUAL TRANSLATION SYSTEM (Default English)
  // ==========================================================================
  const translations = {
    en: {
      nav_sub: "Autonomous Video to PDF Studio",
      hero_pill: "AUTONOMOUS AI LECTURE ARCHITECT · NOTEFLOW ENGINE",
      hero_heading: "Turn any Video Link into <span class=\"text-white-highlight\">Downloadable PDF Study Notes</span>",
      hero_desc: "Paste any YouTube video link. Our AI extracts captions and audio to generate structured, comprehensive, and revision-ready PDF study notes in seconds.",
      quick_label: "Quick Demo:",
      demo_1: "Music / Song",
      demo_2: "3Blue1Brown Neural Nets",
      demo_3: "CS Programming Tutorial",
      tab_url: "YouTube Video Stream",
      tab_manual: "Custom Script / Text",
      url_placeholder: "Paste YouTube link here (e.g. https://www.youtube.com/watch?v=...)",
      manual_title_placeholder: "Video / Topic Title (optional)",
      manual_text_placeholder: "If subtitles are unavailable or you have your own lecture transcript/script, paste it here...",
      btn_generate: "Generate Notes 🚀",
      btn_generate_manual: "Generate from Script 🚀",
      opt_style: "Notes Style",
      opt_style_comp: "📚 Comprehensive Study Notes",
      opt_style_summary: "⚡ Executive Summary & Highlights",
      opt_style_cheat: "📝 Revision Cheat Sheet (Quick Bullets)",
      opt_lang: "Notes Language",
      opt_lang_en: "🇬🇧 English (Default)",
      opt_lang_hi: "🇮🇳 हिन्दी (Hindi)",
      opt_lang_hinglish: "🇮🇳 Hinglish (Casual)",
      opt_lang_auto: "🌐 Auto (Match Video)",
      opt_engine: "AI Synthesis Engine",
      opt_engine_builtin: "⚡ Smart Built-in Engine (Free & Instant)",
      opt_engine_gemini: "🧠 Google Gemini API (Deep Analysis)",
      opt_engine_groq: "🚀 Groq Llama-3.3 (Ultra Fast)",
      step1_title: "Signal Fetch",
      step2_title: "Captions Extract",
      step3_title: "AI Synthesis",
      step4_title: "PDF Compiled",
      badge_processed: "VIDEO SOURCE",
      video_source: "Watch Original Stream ↗",
      btn_download_pdf: "Download PDF",
      btn_print: "Print",
      btn_copy: "Copy",
      btn_markdown: "Markdown",
      btn_edit_notes: "✏️ Edit Notes",
      btn_view_preview: "👁️ View Preview",
      notes_status: "Compiled & ready for export",
      transcript_accordion: "Inspect Raw Captions & Timestamps Telemetry",
      settings_title: "⚙️ Settings & Custom API Keys",
      settings_desc: "By default, the <strong>Smart Built-in Engine</strong> runs 100% free with no API keys required. If you prefer deeper synthesis with Google Gemini or Groq, you can optionally provide your free API key below.",
      settings_gemini_label: "Google Gemini API Key (Free tier):",
      settings_groq_label: "Groq API Key (Llama 3.3):",
      settings_save: "Save Settings 💾",
      toast_clipboard_pasted: "Link pasted from clipboard!",
      toast_clipboard_prompt: "Please allow clipboard access or press Ctrl+V.",
      toast_empty_url: "Please enter a valid YouTube video link first!",
      toast_empty_manual: "Please paste your script or lecture text first!",
      toast_settings_saved: "Settings & API Keys saved successfully!",
      toast_notes_copied: "Notes copied to clipboard! 📋",
      toast_notes_updated: "Notes updated successfully!",
      toast_md_download: "Downloading Markdown file...",
      toast_pdf_generating: "Compiling vector PDF document...",
      toast_pdf_success: "PDF download started! 📄",
      toast_pdf_error: "PDF generation failed, please try the Print button.",
      step1_active: "Connecting to video stream...",
      step1_desc: "Verifying video telemetry and author metadata...",
      step2_active: "Subtitles extracted successfully!",
      step3_active: "AI Synthesizing study notes in English...",
      step4_active: "Notes compilation complete!",
      step4_desc: "Your high-resolution PDF document is ready.",
      error_no_captions_title: "Subtitles / Captions Not Found",
      error_switch_manual_btn: "✍️ Paste Script or Text Instead"
    },
    hi: {
      nav_sub: "स्वायत्त वीडियो से पीडीएफ नोट्स स्टूडियो",
      hero_pill: "स्वायत्त AI व्याख्यान वास्तुकार · NOTEFLOW इंजन",
      hero_heading: "किसी भी वीडियो का लिंक पेस्ट करें और पाएं <span class=\"text-white-highlight\">डाउनलोड करने योग्य PDF स्टडी नोट्स</span>",
      hero_desc: "किसी भी यूट्यूब वीडियो का लिंक पेस्ट करें। हमारा AI सबटाइटल्स और ऑडियो को एक्सट्रैक्ट करके सेकंडों में सुंदर, स्ट्रक्चर्ड और रिवीजन-रेडी PDF नोट्स तैयार कर देगा।",
      quick_label: "क्विक डेमो:",
      demo_1: "म्यूजिक / सॉन्ग",
      demo_2: "3Blue1Brown न्यूरल नेटवर्क्स",
      demo_3: "CS प्रोग्रामिंग ट्यूटोरियल",
      tab_url: "यूट्यूब वीडियो स्ट्रीम",
      tab_manual: "कस्टम स्क्रिप्ट / टेक्स्ट",
      url_placeholder: "यूट्यूब वीडियो लिंक यहां पेस्ट करें (उदा. https://www.youtube.com/watch?v=...)",
      manual_title_placeholder: "वीडियो / टॉपिक का शीर्षक (वैकल्पिक)",
      manual_text_placeholder: "यदि वीडियो में सबटाइटल्स उपलब्ध नहीं हैं या आपके पास अपना लेक्चर ट्रांसक्रिप्ट है, तो यहां पेस्ट करें...",
      btn_generate: "नोट्स बनाएं 🚀",
      btn_generate_manual: "स्क्रिप्ट से नोट्स बनाएं 🚀",
      opt_style: "नोट्स स्टाइल",
      opt_style_comp: "📚 विस्तृत स्टडी नोट्स (Comprehensive)",
      opt_style_summary: "⚡ मुख्य सारांश एवं हाइलाइट्स (Summary)",
      opt_style_cheat: "📝 रिवीजन चीट शीट (Quick Bullets)",
      opt_lang: "नोट्स की भाषा",
      opt_lang_en: "🇬🇧 English (अंग्रेजी)",
      opt_lang_hi: "🇮🇳 हिन्दी (Hindi)",
      opt_lang_hinglish: "🇮🇳 हिंग्लिश (Casual Hinglish)",
      opt_lang_auto: "🌐 ऑटो (वीडियो के अनुसार)",
      opt_engine: "AI सिंथेसिस इंजन",
      opt_engine_builtin: "⚡ स्मार्ट बिल्ट-इन इंजन (फ्री एवं इंस्टेंट)",
      opt_engine_gemini: "🧠 गूगल जेमिनी API (डीप एनालिसिस)",
      opt_engine_groq: "🚀 Groq Llama-3.3 (अल्ट्रा फास्ट)",
      step1_title: "सिग्नल फेच",
      step2_title: "सबटाइटल्स एक्सट्रैक्ट",
      step3_title: "AI सिंथेसिस",
      step4_title: "PDF तैयार",
      badge_processed: "वीडियो सोर्स",
      video_source: "मूल स्ट्रीम देखें ↗",
      btn_download_pdf: "PDF डाउनलोड करें",
      btn_print: "प्रिंट",
      btn_copy: "कॉपी",
      btn_markdown: "मार्कडाउन",
      btn_edit_notes: "✏️ नोट्स एडिट करें",
      btn_view_preview: "👁️ प्रीव्यू देखें",
      notes_status: "रिव्यू और डाउनलोड के लिए तैयार",
      transcript_accordion: "मूल सबटाइटल्स एवं टाइमस्टैम्प टेलीमेट्री देखें",
      settings_title: "⚙️ सेटिंग्स एवं कस्टम API कीज़",
      settings_desc: "डिफ़ॉल्ट रूप से <strong>स्मार्ट बिल्ट-इन इंजन</strong> बिना किसी API key के बिल्कुल फ्री चलता है। यदि आप गूगल जेमिनी या Groq उपयोग करना चाहते हैं तो अपनी फ्री की दर्ज करें।",
      settings_gemini_label: "गूगल जेमिनी API Key (फ्री टियर):",
      settings_groq_label: "Groq API Key (Llama 3.3):",
      settings_save: "सेटिंग्स सेव करें 💾",
      toast_clipboard_pasted: "क्लिपबोर्ड से लिंक पेस्ट हो गया!",
      toast_clipboard_prompt: "कृपया क्लिपबोर्ड एक्सेस की अनुमति दें या Ctrl+V दबाएं।",
      toast_empty_url: "कृपया पहले यूट्यूब वीडियो का लिंक दर्ज करें!",
      toast_empty_manual: "कृपया पहले अपनी स्क्रिप्ट/टेक्स्ट पेस्ट करें!",
      toast_settings_saved: "सेटिंग्स सफलतापूर्वक सेव हो गईं!",
      toast_notes_copied: "नोट्स क्लिपबोर्ड पर कॉपी हो गए! 📋",
      toast_notes_updated: "नोट्स सफलतापूर्वक अपडेट हो गए!",
      toast_md_download: "मार्कडाउन फ़ाइल डाउनलोड हो रही है...",
      toast_pdf_generating: "PDF फ़ाइल तैयार हो रही है...",
      toast_pdf_success: "PDF डाउनलोड शुरू हो गया! 📄",
      toast_pdf_error: "PDF जनरेशन में समस्या आई, कृपया प्रिंट बटन का उपयोग करें।",
      step1_active: "वीडियो स्ट्रीम से कनेक्ट हो रहे हैं...",
      step1_desc: "शीर्षक, चैनल और उपलब्धता जांची जा रही है...",
      step2_active: "सबटाइटल्स और कैप्शंस मिल गए!",
      step3_active: "AI नोट्स तैयार हो रहे हैं...",
      step4_active: "नोट्स तैयार हैं!",
      step4_desc: "आपकी उच्च-रिज़ॉल्यूशन PDF तैयार है।",
      error_no_captions_title: "सबटाइटल्स / कैप्शंस नहीं मिले",
      error_switch_manual_btn: "✍️ इसके बजाय मैन्युअल स्क्रिप्ट पेस्ट करें"
    }
  };

  let currentLang = localStorage.getItem('videonote_ui_lang') || 'en';

  const state = {
    video: null,
    transcript: null,
    notesMarkdown: '',
    isEditing: false,
    currentStep: 1
  };

  function t(key) {
    return translations[currentLang]?.[key] || translations['en'][key] || key;
  }

  // DOM Elements
  const btnLangEn = document.getElementById('btnLangEn');
  const btnLangHi = document.getElementById('btnLangHi');
  const videoUrlInput = document.getElementById('videoUrlInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const clearBtn = document.getElementById('clearBtn');
  const generateBtn = document.getElementById('generateBtn');
  const manualTitle = document.getElementById('manualTitle');
  const manualTextInput = document.getElementById('manualTextInput');
  const generateManualBtn = document.getElementById('generateManualBtn');

  const noteStyleSelect = document.getElementById('noteStyle');
  const noteLangSelect = document.getElementById('noteLang');
  const aiProviderSelect = document.getElementById('aiProvider');

  const progressSection = document.getElementById('progressSection');
  const progressTitle = document.getElementById('progressTitle');
  const progressSub = document.getElementById('progressSub');

  const errorCard = document.getElementById('errorCard');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const errorActions = document.getElementById('errorActions');

  const notesEmptyState = document.getElementById('notesEmptyState');
  const resultsSection = document.getElementById('resultsSection');
  const videoThumb = document.getElementById('videoThumb');
  const videoTitle = document.getElementById('videoTitle');
  const videoAuthor = document.getElementById('videoAuthor');
  const videoWords = document.getElementById('videoWords');
  const videoDuration = document.getElementById('videoDuration');
  const videoLink = document.getElementById('videoLink');
  const engineBadge = document.getElementById('engineBadge');

  const renderedContent = document.getElementById('renderedContent');
  const editNotesArea = document.getElementById('editNotesArea');
  const toggleEditBtn = document.getElementById('toggleEditBtn');
  const btnNotebookMode = document.getElementById('btnNotebookMode');
  const btnCyberMode = document.getElementById('btnCyberMode');
  const notesDocument = document.getElementById('notesDocument');

  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const printPdfBtn = document.getElementById('printPdfBtn');
  const copyNotesBtn = document.getElementById('copyNotesBtn');
  const downloadMdBtn = document.getElementById('downloadMdBtn');

  const transcriptToggle = document.getElementById('transcriptToggle');
  const transcriptBody = document.getElementById('transcriptBody');
  const transcriptList = document.getElementById('transcriptList');

  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const groqApiKeyInput = document.getElementById('groqApiKey');
  const toast = document.getElementById('toast');

  function setUILanguage(lang) {
    currentLang = lang === 'hi' ? 'hi' : 'en';
    localStorage.setItem('videonote_ui_lang', currentLang);

    if (currentLang === 'hi') {
      btnLangHi.classList.add('active');
      btnLangEn.classList.remove('active');
      document.documentElement.lang = 'hi';
    } else {
      btnLangEn.classList.add('active');
      btnLangHi.classList.remove('active');
      document.documentElement.lang = 'en';
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[currentLang][key]) {
        if (key === 'settings_desc') {
          el.innerHTML = translations[currentLang][key];
        } else {
          el.textContent = translations[currentLang][key];
        }
      }
    });

    const heroHeading = document.getElementById('heroHeading');
    if (heroHeading && translations[currentLang].hero_heading) {
      heroHeading.innerHTML = translations[currentLang].hero_heading;
    }

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (translations[currentLang][key]) {
        el.placeholder = translations[currentLang][key];
      }
    });

    if (state.isEditing) {
      toggleEditBtn.textContent = t('btn_view_preview');
    } else {
      toggleEditBtn.textContent = t('btn_edit_notes');
    }
  }

  btnLangEn.addEventListener('click', () => setUILanguage('en'));
  btnLangHi.addEventListener('click', () => setUILanguage('hi'));
  setUILanguage(currentLang);

  // Load API Keys
  geminiApiKeyInput.value = localStorage.getItem('videonote_gemini_key') || '';
  groqApiKeyInput.value = localStorage.getItem('videonote_groq_key') || '';

  saveSettingsBtn.addEventListener('click', () => {
    localStorage.setItem('videonote_gemini_key', geminiApiKeyInput.value.trim());
    localStorage.setItem('videonote_groq_key', groqApiKeyInput.value.trim());
    showToast(t('toast_settings_saved'));
  });

  // Clear / Input events
  videoUrlInput.addEventListener('input', () => {
    if (videoUrlInput.value.trim().length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  });

  clearBtn.addEventListener('click', () => {
    videoUrlInput.value = '';
    clearBtn.classList.add('hidden');
    videoUrlInput.focus();
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        videoUrlInput.value = text.trim();
        clearBtn.classList.remove('hidden');
        showToast(t('toast_clipboard_pasted'));
      }
    } catch (e) {
      videoUrlInput.focus();
      showToast(t('toast_clipboard_prompt'));
    }
  });

  // Demo Chips: Click anywhere -> switch to synthesizer & auto start
  document.querySelectorAll('.demo-chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-url');
      videoUrlInput.value = url;
      clearBtn.classList.remove('hidden');
      navigateToPage('page-synthesizer');
      startGenerationFlow(url);
    });
  });

  // Deck Tabs inside Synthesizer
  document.querySelectorAll('.deck-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.deck-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  generateBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
      showToast(t('toast_empty_url'));
      videoUrlInput.focus();
      return;
    }
    startGenerationFlow(url);
  });

  generateManualBtn.addEventListener('click', () => {
    const text = manualTextInput.value.trim();
    if (!text) {
      showToast(t('toast_empty_manual'));
      manualTextInput.focus();
      return;
    }
    startManualGenerationFlow(manualTitle.value.trim(), text);
  });

  transcriptToggle.addEventListener('click', () => {
    transcriptToggle.classList.toggle('open');
    transcriptBody.classList.toggle('hidden');
  });

  // Initialize Mermaid with Hand-Drawn aesthetic for flowcharts
  if (window.mermaid) {
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        look: 'handDrawn',
        fontFamily: "'Kalam', cursive, sans-serif",
        securityLevel: 'loose'
      });
    } catch (e) {
      console.warn('Mermaid initialization warning:', e);
    }
  }

  // Notebook View Mode Switcher
  if (btnNotebookMode && btnCyberMode && notesDocument) {
    btnNotebookMode.addEventListener('click', () => {
      btnNotebookMode.classList.add('active');
      btnCyberMode.classList.remove('active');
      notesDocument.classList.add('notebook-mode');
    });

    btnCyberMode.addEventListener('click', () => {
      btnCyberMode.classList.add('active');
      btnNotebookMode.classList.remove('active');
      notesDocument.classList.remove('notebook-mode');
    });
  }

  toggleEditBtn.addEventListener('click', () => {
    state.isEditing = !state.isEditing;
    if (state.isEditing) {
      editNotesArea.value = state.notesMarkdown;
      editNotesArea.classList.remove('hidden');
      renderedContent.classList.add('hidden');
      toggleEditBtn.textContent = t('btn_view_preview');
    } else {
      state.notesMarkdown = editNotesArea.value;
      renderMarkdown(state.notesMarkdown);
      editNotesArea.classList.add('hidden');
      renderedContent.classList.remove('hidden');
      toggleEditBtn.textContent = t('btn_edit_notes');
      showToast(t('toast_notes_updated'));
    }
  });

  copyNotesBtn.addEventListener('click', async () => {
    const textToCopy = state.isEditing ? editNotesArea.value : state.notesMarkdown;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast(t('toast_notes_copied'));
    } catch (e) {
      showToast('Could not copy automatically. Please copy manually.');
    }
  });

  downloadMdBtn.addEventListener('click', () => {
    const textToDownload = state.isEditing ? editNotesArea.value : state.notesMarkdown;
    if (!textToDownload) return;

    const safeTitle = (state.video?.title || 'Video_Notes').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const blob = new Blob([textToDownload], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}_Notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('toast_md_download'));
  });

  printPdfBtn.addEventListener('click', () => {
    window.print();
  });

  downloadPdfBtn.addEventListener('click', async () => {
    const currentMarkdown = state.isEditing ? editNotesArea.value : state.notesMarkdown;
    if (!currentMarkdown) return;

    downloadPdfBtn.disabled = true;
    const originalText = downloadPdfBtn.innerHTML;
    downloadPdfBtn.innerHTML = `<span>${t('toast_pdf_generating')}</span>`;

    try {
      const response = await fetch('/api/download-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.video?.title || 'Video Study Notes',
          author: state.video?.author || 'Creator',
          videoUrl: state.video?.url || '',
          notesMarkdown: currentMarkdown
        })
      });

      if (!response.ok) throw new Error('PDF generation request failed.');

      const blob = await response.blob();
      const safeTitle = (state.video?.title || 'Video_Notes').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${safeTitle}_Notes.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      showToast(t('toast_pdf_success'));
    } catch (err) {
      console.error(err);
      showToast(t('toast_pdf_error'));
    } finally {
      downloadPdfBtn.disabled = false;
      downloadPdfBtn.innerHTML = originalText;
    }
  });

  // Main Pipeline for Video URL
  async function startGenerationFlow(url) {
    hideError();
    progressSection.classList.remove('hidden');

    const provider = aiProviderSelect.value;
    const style = noteStyleSelect.value;
    const language = noteLangSelect.value;
    const apiKey = provider === 'gemini' 
      ? localStorage.getItem('videonote_gemini_key') 
      : (provider === 'groq' ? localStorage.getItem('videonote_groq_key') : null);

    setStep(1, t('step1_active'), t('step1_desc'));

    try {
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const extractData = await extractRes.json();

      if (!extractRes.ok) {
        if (extractData.video) state.video = extractData.video;
        throw new Error(extractData.error || 'Could not extract video transcript.');
      }

      state.video = extractData.video;
      state.transcript = extractData.transcript;

      setStep(2, t('step2_active'), `${state.transcript.wordCount} words extracted.`);
      await delay(400);

      setStep(3, t('step3_active'), `${provider.toUpperCase()} AI synthesizer processing study notes in English...`);

      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.video.title,
          author: state.video.author,
          transcriptData: state.transcript,
          provider,
          apiKey,
          style,
          language
        })
      });

      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || 'Notes generation failed.');

      state.notesMarkdown = genData.notesMarkdown;

      setStep(4, t('step4_active'), t('step4_desc'));
      await delay(500);

      progressSection.classList.add('hidden');

      // Seamless Page Transition into Study Notes Page!
      renderResults(genData.provider, genData.warning);
      navigateToPage('page-notes');

    } catch (err) {
      console.error(err);
      progressSection.classList.add('hidden');
      showError(err.message, state.video);
    }
  }

  // Manual generation flow
  async function startManualGenerationFlow(title, text) {
    hideError();
    progressSection.classList.remove('hidden');

    const provider = aiProviderSelect.value;
    const style = noteStyleSelect.value;
    const language = noteLangSelect.value;
    const apiKey = provider === 'gemini' 
      ? localStorage.getItem('videonote_gemini_key') 
      : (provider === 'groq' ? localStorage.getItem('videonote_groq_key') : null);

    setStep(1, 'Processing script...', 'Analyzing input text tokens...');

    state.video = {
      title: title || 'Custom Lecture / Script Notes',
      author: 'User Provided',
      url: '',
      thumbnailUrl: ''
    };

    state.transcript = {
      items: [{ timestamp: '00:00', text }],
      fullText: text,
      wordCount: text.split(/\s+/).length,
      approxDuration: 'N/A'
    };

    try {
      setStep(3, t('step3_active'), 'Structuring notes in English...');

      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.video.title,
          author: state.video.author,
          transcriptData: state.transcript,
          provider,
          apiKey,
          style,
          language
        })
      });

      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || 'Notes generation failed.');

      state.notesMarkdown = genData.notesMarkdown;
      setStep(4, t('step4_active'), t('step4_desc'));
      await delay(400);

      progressSection.classList.add('hidden');

      // Navigate to Study Notes Page
      renderResults(genData.provider);
      navigateToPage('page-notes');

    } catch (err) {
      progressSection.classList.add('hidden');
      showError(err.message);
    }
  }

  function renderResults(usedProvider, warning) {
    notesEmptyState.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    if (state.video?.thumbnailUrl) {
      videoThumb.src = state.video.thumbnailUrl;
      videoThumb.classList.remove('hidden');
    } else {
      videoThumb.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="170" height="98" fill="%23101216"><rect width="100%" height="100%"/></svg>';
    }

    videoTitle.textContent = state.video?.title || 'Video Study Notes';
    videoAuthor.textContent = state.video?.author || 'Creator';
    videoWords.textContent = `${state.transcript?.wordCount || 0} words analyzed`;
    videoDuration.textContent = state.transcript?.approxDuration ? `Duration ~${state.transcript.approxDuration}` : '';

    if (state.video?.url) {
      videoLink.href = state.video.url;
      videoLink.classList.remove('hidden');
    } else {
      videoLink.classList.add('hidden');
    }

    if (usedProvider === 'gemini') {
      engineBadge.textContent = '🧠 POWERED BY GOOGLE GEMINI';
      engineBadge.style.color = '#38bdf8';
    } else if (usedProvider === 'groq') {
      engineBadge.textContent = '🚀 POWERED BY GROQ LLAMA-3.3';
      engineBadge.style.color = '#fbbf24';
    } else {
      engineBadge.textContent = '⚡ POWERED BY SMART BUILT-IN ENGINE';
      engineBadge.style.color = '#34d399';
    }

    if (warning) showToast(warning);

    renderMarkdown(state.notesMarkdown);
    renderTranscriptList(state.transcript?.items || []);
  }

  async function renderMarkdown(md) {
    if (window.marked && typeof window.marked.parse === 'function') {
      renderedContent.innerHTML = window.marked.parse(md);
    } else {
      renderedContent.textContent = md;
    }

    // 1. Process Mermaid Diagrams & Flowcharts
    const codeBlocks = renderedContent.querySelectorAll('pre code');
    let hasMermaid = false;

    codeBlocks.forEach(block => {
      const codeText = block.textContent.trim();
      if (block.classList.contains('language-mermaid') || codeText.startsWith('graph ') || codeText.startsWith('flowchart ')) {
        const pre = block.closest('pre');
        if (pre) {
          const container = document.createElement('div');
          container.className = 'mermaid-container';
          const mermaidDiv = document.createElement('div');
          mermaidDiv.className = 'mermaid';
          mermaidDiv.textContent = codeText;
          container.appendChild(mermaidDiv);
          pre.parentNode.replaceChild(container, pre);
          hasMermaid = true;
        }
      }
    });

    if (hasMermaid && window.mermaid) {
      try {
        await window.mermaid.run({
          nodes: renderedContent.querySelectorAll('.mermaid')
        });
      } catch (merr) {
        console.warn('Mermaid render issue:', merr);
      }
    }

    // 2. Process Sticky Notes (> 📌 or > 💡)
    renderedContent.querySelectorAll('blockquote').forEach(bq => {
      const bqText = bq.textContent;
      if (bqText.includes('📌') || bqText.toLowerCase().includes('sticky note')) {
        bq.classList.add('sticky-note');
      } else if (bqText.includes('💡') || bqText.toLowerCase().includes('tip')) {
        bq.classList.add('sticky-note', 'sticky-tip');
      }
    });

    // 3. Process Visual Slide Reconstructions (### 🖼️ Visual Slide)
    renderedContent.querySelectorAll('h3').forEach(h3 => {
      if (h3.textContent.includes('🖼️') || h3.textContent.toLowerCase().includes('visual slide')) {
        const timeMatch = h3.textContent.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
        const timeStr = timeMatch ? timeMatch[1] : null;

        const card = document.createElement('div');
        card.className = 'visual-slide-card';

        const headerBar = document.createElement('div');
        headerBar.className = 'slide-header-bar';

        const titleSpan = document.createElement('strong');
        titleSpan.textContent = h3.textContent;
        headerBar.appendChild(titleSpan);

        if (timeStr && state.video?.videoId && state.video.videoId !== 'manual') {
          const sec = parseTimeToSeconds(timeStr);
          const badge = document.createElement('button');
          badge.type = 'button';
          badge.className = 'slide-badge-time';
          badge.innerHTML = `<span>▶ Jump to ${timeStr}</span>`;
          badge.addEventListener('click', () => {
            window.open(`https://www.youtube.com/watch?v=${state.video.videoId}&t=${sec}s`, '_blank');
          });
          headerBar.appendChild(badge);
        }

        card.appendChild(headerBar);

        let next = h3.nextElementSibling;
        const toMove = [];
        while (next && next.tagName !== 'H3' && next.tagName !== 'H2' && next.tagName !== 'HR') {
          toMove.push(next);
          next = next.nextElementSibling;
        }

        h3.parentNode.insertBefore(card, h3);
        h3.parentNode.removeChild(h3);

        toMove.forEach(el => {
          if (el.tagName === 'UL') {
            const whiteboard = document.createElement('div');
            whiteboard.className = 'slide-whiteboard-canvas';
            whiteboard.appendChild(el);
            card.appendChild(whiteboard);
          } else {
            card.appendChild(el);
          }
        });
      }
    });

    // 4. Interactive Timestamps in Chapter Notes
    renderedContent.querySelectorAll('strong, em, span, p, li').forEach(el => {
      if (el.closest('.slide-header-bar')) return;
      const match = el.textContent.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
      if (match && state.video?.videoId && state.video.videoId !== 'manual') {
        const timeStr = match[1];
        const sec = parseTimeToSeconds(timeStr);
        el.style.cursor = 'pointer';
        el.title = `Jump to ${timeStr} on YouTube`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(`https://www.youtube.com/watch?v=${state.video.videoId}&t=${sec}s`, '_blank');
        });
      }
    });
  }

  function renderTranscriptList(items) {
    transcriptList.innerHTML = '';
    if (!items || items.length === 0) {
      transcriptList.innerHTML = '<p style="color: var(--ink-muted); font-family: var(--font-mono); font-size: 12px;">No subtitles available in stream.</p>';
      return;
    }

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'transcript-row';

      const timeBtn = document.createElement('span');
      timeBtn.className = 'time-pill';
      timeBtn.textContent = item.timestamp;
      timeBtn.title = `Watch at ${item.timestamp}`;

      if (state.video?.videoId && state.video.videoId !== 'manual') {
        timeBtn.addEventListener('click', () => {
          const sec = parseTimeToSeconds(item.timestamp);
          window.open(`https://www.youtube.com/watch?v=${state.video.videoId}&t=${sec}s`, '_blank');
        });
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'transcript-text';
      textSpan.textContent = item.text;

      row.appendChild(timeBtn);
      row.appendChild(textSpan);
      transcriptList.appendChild(row);
    });
  }

  function setStep(stepNum, title, sub) {
    progressTitle.textContent = title;
    progressSub.textContent = sub;

    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`step${i}`);
      const lineEl = document.getElementById(`line${i}`);
      const stateSpan = stepEl.querySelector('.node-state');

      if (i < stepNum) {
        stepEl.className = 'stepper-node completed';
        if (stateSpan) stateSpan.textContent = 'DONE';
        if (lineEl) lineEl.className = 'stepper-line completed';
      } else if (i === stepNum) {
        stepEl.className = 'stepper-node active';
        if (stateSpan) stateSpan.textContent = 'ACTIVE';
        if (lineEl) lineEl.className = 'stepper-line';
      } else {
        stepEl.className = 'stepper-node';
        if (stateSpan) stateSpan.textContent = 'PENDING';
        if (lineEl) lineEl.className = 'stepper-line';
      }
    }
  }

  function showError(msg, video) {
    errorCard.classList.remove('hidden');
    errorMessage.textContent = msg;
    errorActions.innerHTML = '';

    if (msg.toLowerCase().includes('subtitles') || msg.toLowerCase().includes('captions') || msg.toLowerCase().includes('transcript')) {
      errorTitle.textContent = t('error_no_captions_title');
      const switchBtn = document.createElement('button');
      switchBtn.className = 'btn-orbital-glow';
      switchBtn.style.height = '42px';
      switchBtn.style.marginTop = '12px';
      switchBtn.innerHTML = `<span class="btn-content">${t('error_switch_manual_btn')}</span>`;
      switchBtn.addEventListener('click', () => {
        hideError();
        document.querySelector('[data-tab="tab-manual"]').click();
        if (video?.title) manualTitle.value = video.title;
      });
      errorActions.appendChild(switchBtn);
    } else {
      errorTitle.textContent = currentLang === 'hi' ? 'त्रुटि (Error)' : 'Signal Processing Error';
    }

    errorCard.scrollIntoView({ behavior: 'smooth' });
  }

  function hideError() {
    errorCard.classList.add('hidden');
  }

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  function parseTimeToSeconds(str) {
    const parts = str.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
