// Observatory Animation Module
// Cinematic journey: observatory → telescope eyepiece → optics interior →
// data transformation → financial cosmos → pull-back to lens

const ObservatoryAnimation = (function () {
    let canvas, ctx, w, h;
    let startTime = null;
    let onComplete = null;
    let animFrameId = null;
    let skipped = false;

    const DURATION = 40000; // 40 seconds total

    // --- Utility ---
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeIn(t) { return t * t; }
    function easeOut(t) { return 1 - (1 - t) * (1 - t); }
    function smoothstep(edge0, edge1, x) {
        const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    // Seeded PRNG for deterministic particle placement
    function seededRng(seed) {
        let s = seed;
        return function () {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    // --- Particle / object pools ---
    let dust = [];
    let lensRings = [];
    let stars = [];
    let neural = { nodes: [], edges: [] };
    let candles = [];
    let comets = [];
    let orderColumns = [];

    function initParticles() {
        const rng = seededRng(42);

        // Dust motes floating in light beams (observatory scene)
        dust = [];
        for (let i = 0; i < 250; i++) {
            dust.push({
                x: rng() * w,
                y: rng() * h,
                size: 0.4 + rng() * 1.8,
                speed: 0.05 + rng() * 0.2,
                drift: (rng() - 0.5) * 0.15,
                opacity: 0.15 + rng() * 0.45,
                phase: rng() * Math.PI * 2
            });
        }

        // Lens elements inside telescope
        lensRings = [];
        for (let i = 0; i < 10; i++) {
            lensRings.push({
                z: i * 0.11 + 0.04,
                radius: 0.14 + rng() * 0.08,
                hue: 200 + i * 18,
                thickness: 1.5 + rng() * 3,
                rotSpeed: (rng() - 0.5) * 0.0008
            });
        }

        // Galaxy stars – spiral arms with sector coloring
        stars = [];
        for (let i = 0; i < 700; i++) {
            const arm = Math.floor(rng() * 3);
            const armBase = arm * (Math.PI * 2 / 3);
            const dist = 0.02 + rng() * 0.48;
            const spiralAngle = armBase + dist * 4.5 + (rng() - 0.5) * 0.6;

            // sector color
            const sector = Math.floor(rng() * 4);
            let hue, sat;
            if (sector === 0) { hue = 215; sat = 85; }      // tech – electric blue
            else if (sector === 1) { hue = 30; sat = 90; }   // energy – amber
            else if (sector === 2) { hue = 145; sat = 70; }  // healthcare – green
            else { hue = 275; sat = 65; }                     // finance – purple

            stars.push({
                angle: spiralAngle,
                dist: dist,
                size: 0.4 + rng() * 2.8,
                hue: hue + (rng() - 0.5) * 25,
                sat: sat,
                brightness: 0.25 + rng() * 0.75,
                twinklePhase: rng() * Math.PI * 2,
                twinkleSpeed: 0.4 + rng() * 2.2,
                ySkew: 0.5 + rng() * 0.4
            });
        }

        // Neural network
        neural.nodes = [];
        neural.edges = [];
        for (let i = 0; i < 50; i++) {
            neural.nodes.push({
                x: (rng() - 0.5) * 0.9,
                y: (rng() - 0.5) * 0.9,
                layer: Math.floor(rng() * 6),
                size: 2.5 + rng() * 6,
                pulsePhase: rng() * Math.PI * 2,
                pulseSpeed: 0.4 + rng() * 1.6
            });
        }
        for (let i = 0; i < neural.nodes.length; i++) {
            for (let j = i + 1; j < neural.nodes.length; j++) {
                const dx = neural.nodes[i].x - neural.nodes[j].x;
                const dy = neural.nodes[i].y - neural.nodes[j].y;
                if (Math.sqrt(dx * dx + dy * dy) < 0.28 && rng() > 0.35) {
                    neural.edges.push({ from: i, to: j, strength: 0.3 + rng() * 0.7 });
                }
            }
        }

        // Candlestick formations
        candles = [];
        for (let i = 0; i < 70; i++) {
            const open = 0.3 + rng() * 0.4;
            const close = 0.3 + rng() * 0.4;
            candles.push({
                open: open,
                close: close,
                high: Math.max(open, close) + rng() * 0.1,
                low: Math.min(open, close) - rng() * 0.1,
                bullish: close > open
            });
        }

        // Derivative comets
        comets = [];
        for (let i = 0; i < 10; i++) {
            comets.push({
                phase: rng() * Math.PI * 2,
                speed: 0.0004 + rng() * 0.0008,
                radius: 0.18 + rng() * 0.32,
                ecc: 0.25 + rng() * 0.5,
                hue: 170 + rng() * 70,
                tailLen: 18 + rng() * 30
            });
        }

        // Order book columns
        orderColumns = [];
        for (let i = 0; i < 40; i++) {
            orderColumns.push({
                x: (rng() - 0.5) * 1.6,
                height: 0.05 + rng() * 0.25,
                width: 0.008 + rng() * 0.012,
                hue: rng() > 0.5 ? 130 : 0,
                speed: 0.5 + rng() * 1.5,
                phase: rng() * Math.PI * 2
            });
        }
    }

    // ================================================================
    //  PHASE 1 — Observatory before dawn
    // ================================================================
    function drawObservatory(t, elapsed) {
        const fadeIn = smoothstep(0, 0.12, t);
        const fadeOut = 1 - smoothstep(0.82, 1, t);
        const a = fadeIn * fadeOut;
        ctx.save();
        ctx.globalAlpha = a;

        // Warm-dark background
        ctx.fillStyle = '#090706';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;

        // --- Narrow beams of cold light from dome slit ---
        for (let i = 0; i < 4; i++) {
            const bx = w * (0.45 + i * 0.06);
            const angle = -0.22 - i * 0.04;
            ctx.save();
            ctx.translate(bx, 0);
            ctx.rotate(angle);
            const bg = ctx.createLinearGradient(0, 0, 0, h * 1.1);
            bg.addColorStop(0, `rgba(170, 175, 190, ${0.045 * fadeIn})`);
            bg.addColorStop(0.5, `rgba(170, 175, 190, ${0.018 * fadeIn})`);
            bg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = bg;
            ctx.fillRect(-12, -20, 24, h * 1.2);
            ctx.restore();
        }

        // --- Dust particles drifting in beams ---
        for (const p of dust) {
            const px = p.x + Math.sin(elapsed * 0.00025 + p.phase) * 18 + p.drift * elapsed * 0.01;
            const py = (p.y + elapsed * p.speed * 0.04) % h;
            // Only in beam area
            if (px > w * 0.38 && px < w * 0.75 && py < h * 0.75) {
                const flicker = 0.5 + 0.5 * Math.sin(elapsed * 0.0012 + p.phase);
                ctx.beginPath();
                ctx.arc(px % w, py, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(210, 205, 185, ${p.opacity * 0.5 * flicker * a})`;
                ctx.fill();
            }
        }

        // --- Dome arch ---
        ctx.beginPath();
        ctx.ellipse(cx, h * 0.12, w * 0.46, h * 0.38, 0, Math.PI, 0);
        ctx.strokeStyle = `rgba(55, 50, 46, ${0.6 * a})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Dome slit opening
        const slitW = 28;
        ctx.beginPath();
        ctx.moveTo(cx - slitW, h * 0.12 - h * 0.37);
        ctx.lineTo(cx - slitW, h * 0.12);
        ctx.moveTo(cx + slitW, h * 0.12 - h * 0.37);
        ctx.lineTo(cx + slitW, h * 0.12);
        ctx.strokeStyle = `rgba(40, 37, 34, ${0.7 * a})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Faint star visible through slit
        const starSlit = ctx.createRadialGradient(cx, h * 0.05, 0, cx, h * 0.05, 30);
        starSlit.addColorStop(0, `rgba(230, 235, 255, ${0.6 * a})`);
        starSlit.addColorStop(0.15, `rgba(180, 200, 255, ${0.2 * a})`);
        starSlit.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = starSlit;
        ctx.fillRect(cx - 30, h * 0.05 - 30, 60, 60);

        // --- Telescope body ---
        const teleY = h * 0.52;
        const tLen = w * 0.36;
        const tW1 = 32; // eyepiece
        const tW2 = 48; // objective
        const tilt = -0.04;

        ctx.save();
        ctx.translate(cx, teleY);
        ctx.rotate(tilt);

        // Tube
        const tubeG = ctx.createLinearGradient(-tLen / 2, -tW2, tLen / 2, tW2);
        tubeG.addColorStop(0, `rgba(48, 44, 40, ${0.9 * a})`);
        tubeG.addColorStop(0.35, `rgba(68, 62, 56, ${0.92 * a})`);
        tubeG.addColorStop(0.65, `rgba(58, 53, 48, ${0.9 * a})`);
        tubeG.addColorStop(1, `rgba(42, 40, 37, ${0.88 * a})`);

        ctx.beginPath();
        ctx.moveTo(-tLen / 2, -tW1 / 2);
        ctx.lineTo(tLen / 2, -tW2 / 2);
        ctx.lineTo(tLen / 2, tW2 / 2);
        ctx.lineTo(-tLen / 2, tW1 / 2);
        ctx.closePath();
        ctx.fillStyle = tubeG;
        ctx.fill();

        // Scratches / fingerprint evidence
        for (let i = 0; i < 8; i++) {
            const sx = -tLen / 2 + (i + 0.5) * tLen / 8;
            ctx.beginPath();
            ctx.moveTo(sx, -tW1 / 2 + 4);
            ctx.lineTo(sx + (i % 2 === 0 ? 3 : -3), tW1 / 2 - 4);
            ctx.strokeStyle = `rgba(82, 76, 70, ${0.25 * a})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
        }

        // Eyepiece end (left)
        ctx.beginPath();
        ctx.ellipse(-tLen / 2, 0, tW1 / 2, tW1 / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(28, 26, 23, ${0.92 * a})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(72, 66, 60, ${0.5 * a})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Objective lens (right) – star caught in it
        ctx.beginPath();
        ctx.ellipse(tLen / 2, 0, tW2 / 2, tW2 / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(18, 20, 28, ${0.85 * a})`;
        ctx.fill();

        const starGlow = ctx.createRadialGradient(tLen / 2, 0, 0, tLen / 2, 0, tW2 * 1.2);
        starGlow.addColorStop(0, `rgba(220, 228, 255, ${0.7 * a})`);
        starGlow.addColorStop(0.08, `rgba(180, 200, 255, ${0.35 * a})`);
        starGlow.addColorStop(0.3, `rgba(100, 120, 200, ${0.08 * a})`);
        starGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = starGlow;
        ctx.fillRect(tLen / 2 - tW2 * 1.2, -tW2 * 1.2, tW2 * 2.4, tW2 * 2.4);

        // Mount / tripod legs
        ctx.beginPath();
        ctx.moveTo(-15, tW1 / 2 + 8);
        ctx.lineTo(-80, h * 0.38);
        ctx.moveTo(15, tW1 / 2 + 8);
        ctx.lineTo(80, h * 0.38);
        ctx.moveTo(0, tW1 / 2 + 8);
        ctx.lineTo(0, h * 0.38);
        ctx.strokeStyle = `rgba(55, 50, 44, ${0.65 * a})`;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.restore(); // undo telescope transform

        // Floor line
        ctx.beginPath();
        ctx.moveTo(0, h * 0.82);
        ctx.lineTo(w, h * 0.82);
        ctx.strokeStyle = `rgba(35, 32, 28, ${0.4 * a})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore(); // undo globalAlpha
    }

    // ================================================================
    //  PHASE 2 — Camera approaches eyepiece
    // ================================================================
    function drawApproach(t, elapsed) {
        const fadeIn = smoothstep(0, 0.12, t);
        const fadeOut = 1 - smoothstep(0.88, 1, t);
        const a = fadeIn * fadeOut;
        ctx.save();
        ctx.globalAlpha = a;

        ctx.fillStyle = '#040404';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const maxR = Math.hypot(w, h) * 0.6;
        const minR = Math.min(w, h) * 0.04;
        const radius = lerp(minR, maxR, easeIn(t));

        // Outer blackness
        if (radius < maxR) {
            ctx.beginPath();
            ctx.rect(0, 0, w, h);
            ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
            ctx.fillStyle = '#020202';
            ctx.fill();
        }

        // Eyepiece glass
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        const glassG = ctx.createRadialGradient(cx - radius * 0.15, cy - radius * 0.15, 0, cx, cy, radius);
        glassG.addColorStop(0, 'rgba(18, 20, 28, 0.95)');
        glassG.addColorStop(0.6, 'rgba(10, 12, 18, 0.98)');
        glassG.addColorStop(1, 'rgba(5, 5, 10, 1)');
        ctx.fillStyle = glassG;
        ctx.fill();

        // Concentric metallic rings
        for (let i = 0; i < 7; i++) {
            const rr = radius * (0.25 + i * 0.11);
            if (rr < 1) continue;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            const ringA = 0.12 + 0.08 * Math.sin(elapsed * 0.0009 + i);
            ctx.strokeStyle = `rgba(125, 118, 108, ${ringA * a})`;
            ctx.lineWidth = clamp(1 + t * 3, 0.5, 4);
            ctx.stroke();
        }

        // Dome reflection (fades as we get close)
        if (t < 0.55) {
            const refA = (1 - t / 0.55) * 0.12;
            ctx.beginPath();
            ctx.ellipse(cx - radius * 0.18, cy - radius * 0.28, radius * 0.45, radius * 0.14, -0.25, 0, Math.PI);
            ctx.strokeStyle = `rgba(105, 110, 130, ${refA * a})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Machining grooves (visible mid-approach)
        if (t > 0.35 && t < 0.85) {
            const gA = smoothstep(0.35, 0.55, t) * (1 - smoothstep(0.7, 0.85, t)) * 0.18;
            for (let i = 0; i < 25; i++) {
                const gr = radius * (0.82 + i * 0.007);
                if (gr > radius) continue;
                ctx.beginPath();
                ctx.arc(cx, cy, gr, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(85, 80, 72, ${gA * a})`;
                ctx.lineWidth = 0.4;
                ctx.stroke();
            }
        }

        // Rubber eyecup stretching past edges
        if (t > 0.72) {
            const cupA = smoothstep(0.72, 0.9, t);
            const cupW = radius * 0.07;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.arc(cx, cy, radius - cupW, 0, Math.PI * 2, true);
            ctx.fillStyle = `rgba(22, 22, 22, ${cupA * a})`;
            ctx.fill();

            // Rubber texture ridges
            const step = Math.max(0.015, 0.06 / (1 + t));
            for (let ang = 0; ang < Math.PI * 2; ang += step) {
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(ang) * (radius - cupW), cy + Math.sin(ang) * (radius - cupW));
                ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
                ctx.strokeStyle = `rgba(32, 32, 32, ${cupA * 0.3 * a})`;
                ctx.lineWidth = 0.4;
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // ================================================================
    //  PHASE 3 — Inside telescope: corridor of optics
    // ================================================================
    function drawOptics(t, elapsed) {
        const fadeIn = smoothstep(0, 0.08, t);
        const fadeOut = 1 - smoothstep(0.9, 1, t);
        const a = fadeIn * fadeOut;
        ctx.save();
        ctx.globalAlpha = a;

        ctx.fillStyle = '#020205';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);
        const camZ = t * 9; // camera advancing through barrel

        // --- Lens elements ---
        for (const ring of lensRings) {
            const relZ = ring.z * 9 - camZ;
            if (relZ < 0.06 || relZ > 3.5) continue;
            const persp = 1 / relZ;
            const sr = ring.radius * minDim * persp;
            if (sr < 1 || sr > minDim * 2.5) continue;

            const rot = elapsed * ring.rotSpeed;

            // Lens disc
            ctx.beginPath();
            ctx.arc(cx, cy, sr, 0, Math.PI * 2);
            const lg = ctx.createRadialGradient(cx, cy, sr * 0.6, cx, cy, sr);
            lg.addColorStop(0, `rgba(12, 15, 25, ${0.08 * a})`);
            lg.addColorStop(0.85, `rgba(30, 35, 55, ${0.25 * a * persp})`);
            lg.addColorStop(1, `rgba(90, 100, 140, ${0.45 * a * Math.min(1, persp * 0.6)})`);
            ctx.fillStyle = lg;
            ctx.fill();
            ctx.strokeStyle = `rgba(130, 140, 170, ${0.35 * a * Math.min(1, persp * 0.7)})`;
            ctx.lineWidth = ring.thickness * persp;
            ctx.stroke();

            // Prismatic refraction arcs
            const hues = [0, 35, 60, 130, 210, 280];
            for (let b = 0; b < 6; b++) {
                const ba = rot + (b / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(
                    cx + Math.cos(ba) * sr * 0.12,
                    cy + Math.sin(ba) * sr * 0.12,
                    sr * 0.35, ba - 0.35, ba + 0.35
                );
                ctx.strokeStyle = `hsla(${hues[b]}, 85%, 62%, ${0.12 * a * Math.min(1, persp * 0.5)})`;
                ctx.lineWidth = sr * 0.04;
                ctx.stroke();
            }
        }

        // --- Chromatic aberration at frame edges ---
        const abStr = 2.5 + t * 6;
        ctx.beginPath();
        ctx.arc(cx, cy, minDim * 0.46, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(70, 90, 255, ${0.07 * a})`;
        ctx.lineWidth = abStr;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, minDim * 0.47, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 70, 70, ${0.05 * a})`;
        ctx.lineWidth = abStr * 0.65;
        ctx.stroke();

        // --- Ghost images ---
        for (let g = 0; g < 4; g++) {
            const gr = minDim * (0.04 + ((elapsed * 0.0004 + g * 1.2) % 2.5) * 0.06);
            const gx = cx + Math.cos(elapsed * 0.00025 + g * 1.5) * minDim * 0.09;
            const gy = cy + Math.sin(elapsed * 0.00035 + g * 1.9) * minDim * 0.07;
            const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            gg.addColorStop(0, `rgba(140, 160, 255, ${0.055 * a})`);
            gg.addColorStop(0.6, `rgba(90, 110, 200, ${0.02 * a})`);
            gg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Mechanical baffles ---
        if (t > 0.25) {
            const mA = smoothstep(0.25, 0.45, t) * a;
            for (let b = 0; b < 5; b++) {
                const bz = 0.25 + b * 0.14 - (camZ % 0.7);
                if (bz < 0.08 || bz > 1.2) continue;
                const bp = 1 / bz;
                ctx.beginPath();
                ctx.arc(cx, cy, minDim * 0.36 * bp, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(38, 36, 42, ${mA * 0.45 * Math.min(1, bp * 0.4)})`;
                ctx.lineWidth = 7 * bp;
                ctx.stroke();
            }

            // Adjustment screws – tiny circles on baffles
            for (let s = 0; s < 6; s++) {
                const sa = s * Math.PI / 3 + elapsed * 0.0001;
                const sr = minDim * 0.28;
                ctx.beginPath();
                ctx.arc(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr, 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(80, 75, 68, ${mA * 0.3})`;
                ctx.fill();
            }

            // Focusing rails
            const rA = smoothstep(0.35, 0.55, t) * a * 0.25;
            for (let r = -2; r <= 2; r++) {
                if (r === 0) continue;
                ctx.beginPath();
                ctx.moveTo(cx - minDim * 0.38, cy + r * minDim * 0.11);
                ctx.lineTo(cx + minDim * 0.38, cy + r * minDim * 0.11);
                ctx.strokeStyle = `rgba(65, 60, 72, ${rA})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }

        // --- Abstract wireframe transition at end ---
        if (t > 0.7) {
            const wfA = smoothstep(0.7, 0.9, t) * a * 0.35;
            // Grid lines emerging
            for (let i = -8; i <= 8; i++) {
                const offset = i * minDim * 0.05;
                ctx.beginPath();
                ctx.moveTo(cx + offset, cy - minDim * 0.4);
                ctx.lineTo(cx + offset, cy + minDim * 0.4);
                ctx.strokeStyle = `rgba(80, 120, 220, ${wfA})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(cx - minDim * 0.4, cy + offset);
                ctx.lineTo(cx + minDim * 0.4, cy + offset);
                ctx.strokeStyle = `rgba(80, 120, 220, ${wfA})`;
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // ================================================================
    //  PHASE 4 — Data transformation: wireframes → coordinates → data
    // ================================================================
    function drawDataTransform(t, elapsed) {
        const fadeIn = smoothstep(0, 0.1, t);
        const fadeOut = 1 - smoothstep(0.88, 1, t);
        const a = fadeIn * fadeOut;
        ctx.save();
        ctx.globalAlpha = a;

        ctx.fillStyle = '#030208';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);

        const gridProg = smoothstep(0, 0.35, t);
        const axesProg = smoothstep(0.15, 0.5, t);
        const dataProg = smoothstep(0.35, 0.7, t);
        const tunnelProg = smoothstep(0.55, 1, t);

        // --- Perspective wireframe grid ---
        if (gridProg > 0) {
            const gA = gridProg * 0.28 * a;
            const vanY = cy * 0.35;
            // Horizontal lines
            for (let i = 0; i < 22; i++) {
                const gy = lerp(vanY, h * 0.95, Math.pow(i / 22, 1.6));
                const spread = (gy - vanY) / (h * 0.95 - vanY);
                ctx.beginPath();
                ctx.moveTo(cx - spread * w * 0.55, gy);
                ctx.lineTo(cx + spread * w * 0.55, gy);
                ctx.strokeStyle = `rgba(55, 75, 200, ${gA * spread})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
            // Vertical converging
            for (let i = -12; i <= 12; i++) {
                ctx.beginPath();
                ctx.moveTo(cx, vanY);
                ctx.lineTo(cx + i * w * 0.05, h * 0.95);
                ctx.strokeStyle = `rgba(55, 75, 200, ${gA * 0.45})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }

        // --- Coordinate axes ---
        if (axesProg > 0) {
            const aA = axesProg * 0.55 * a;
            // X = time
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.38 * axesProg, cy);
            ctx.lineTo(cx + w * 0.38 * axesProg, cy);
            ctx.strokeStyle = `rgba(90, 170, 255, ${aA})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Y = value
            ctx.beginPath();
            ctx.moveTo(cx, cy + h * 0.34 * axesProg);
            ctx.lineTo(cx, cy - h * 0.34 * axesProg);
            ctx.strokeStyle = `rgba(90, 255, 140, ${aA})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Z = probability (pseudo-3D diagonal)
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.18 * axesProg, cy + h * 0.18 * axesProg);
            ctx.lineTo(cx + w * 0.18 * axesProg, cy - h * 0.18 * axesProg);
            ctx.strokeStyle = `rgba(255, 140, 90, ${aA})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Labels
            if (axesProg > 0.45) {
                const lA = (axesProg - 0.45) / 0.55 * a;
                const fs = Math.round(clamp(12 * (minDim / 800), 9, 16));
                ctx.font = `${fs}px monospace`;
                ctx.fillStyle = `rgba(90, 170, 255, ${lA})`;
                ctx.fillText('TIME', cx + w * 0.33, cy + 18);
                ctx.fillStyle = `rgba(90, 255, 140, ${lA})`;
                ctx.fillText('VALUE', cx + 8, cy - h * 0.29);
                ctx.fillStyle = `rgba(255, 140, 90, ${lA})`;
                ctx.fillText('PROBABILITY', cx + w * 0.12, cy - h * 0.13);
            }
        }

        // --- Streaming numbers ---
        if (dataProg > 0) {
            const fs = Math.round(clamp(10 * (minDim / 800), 8, 14));
            ctx.font = `${fs}px monospace`;
            const nA = dataProg * 0.45 * a;
            for (let i = 0; i < 35; i++) {
                const ft = ((elapsed * 0.0008 + i * 0.28) % 2.8) / 2.8;
                const fx = cx + (ft - 0.5) * w * 0.68;
                const fy = cy + Math.sin(ft * Math.PI * 2 + i) * 6;
                const val = (Math.sin(elapsed * 0.0008 + i * 7.3) * 100).toFixed(2);
                ctx.fillStyle = `rgba(140, 195, 255, ${nA * (1 - Math.abs(ft - 0.5) * 2)})`;
                ctx.fillText(val, fx, fy);
            }
            // Vertical number stream
            for (let i = 0; i < 20; i++) {
                const ft = ((elapsed * 0.0006 + i * 0.35) % 3) / 3;
                const fy = cy + (ft - 0.5) * h * 0.6;
                const fx = cx + Math.cos(ft * Math.PI * 2 + i * 2) * 8;
                const val = (Math.sin(elapsed * 0.001 + i * 3.7) * 50).toFixed(1);
                ctx.fillStyle = `rgba(140, 255, 170, ${nA * 0.7 * (1 - Math.abs(ft - 0.5) * 2)})`;
                ctx.fillText(val, fx, fy);
            }
        }

        // --- Data tunnel forming ---
        if (tunnelProg > 0) {
            const tA = tunnelProg * a;
            for (let ring = 0; ring < 18; ring++) {
                const rz = ((ring * 0.18 + elapsed * 0.0008) % 3.2);
                if (rz < 0.08) continue;
                const persp = 1 / rz;
                const rr = minDim * 0.42 * persp;
                if (rr > minDim) continue;

                ctx.beginPath();
                ctx.arc(cx, cy, rr, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(70, 110, 255, ${tA * 0.18 * Math.min(1, persp * 0.35)})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Streaming light along tunnel walls
                for (let s = 0; s < 8; s++) {
                    const sa = s * Math.PI / 4 + rz * 2;
                    const sx = cx + Math.cos(sa) * rr;
                    const sy = cy + Math.sin(sa) * rr;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1.5 * persp, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(120, 160, 255, ${tA * 0.2 * persp})`;
                    ctx.fill();
                }
            }
        }

        ctx.restore();
    }

    // ================================================================
    //  PHASE 5 — Financial cosmos
    // ================================================================
    function drawCosmos(t, elapsed) {
        const fadeIn = smoothstep(0, 0.06, t);
        const fadeOut = 1 - smoothstep(0.93, 1, t);
        const a = fadeIn * fadeOut;
        ctx.save();
        ctx.globalAlpha = a;

        ctx.fillStyle = '#010107';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);
        const scale = minDim * 0.44;
        const cosRot = elapsed * 0.00004;

        // === Central luminous core (aggregated attention/belief) ===
        const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.45);
        coreG.addColorStop(0, `rgba(255, 215, 140, ${0.28 * a})`);
        coreG.addColorStop(0.15, `rgba(255, 175, 95, ${0.12 * a})`);
        coreG.addColorStop(0.4, `rgba(200, 115, 55, ${0.04 * a})`);
        coreG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreG;
        ctx.fillRect(0, 0, w, h);

        // Gravity-lensing distortion ring around core
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 200, 120, ${0.06 * a})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // === Galaxy stars (market sector companies) ===
        for (const star of stars) {
            const ra = star.angle + cosRot;
            const sx = cx + Math.cos(ra) * star.dist * scale;
            const sy = cy + Math.sin(ra) * star.dist * star.ySkew * scale;
            const twinkle = 0.5 + 0.5 * Math.sin(elapsed * 0.002 * star.twinkleSpeed + star.twinklePhase);
            const br = star.brightness * twinkle;

            ctx.beginPath();
            ctx.arc(sx, sy, star.size * (0.75 + br * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${star.hue}, ${star.sat}%, ${38 + br * 32}%, ${br * 0.75 * a})`;
            ctx.fill();

            if (br > 0.55) {
                const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.size * 5);
                sg.addColorStop(0, `hsla(${star.hue}, ${star.sat}%, 70%, ${br * 0.15 * a})`);
                sg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.arc(sx, sy, star.size * 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // === Supply-chain / capital-flow filaments ===
        ctx.lineWidth = 0.3;
        for (let i = 0; i < stars.length - 1; i += 4) {
            const s1 = stars[i], s2 = stars[i + 1];
            const r1 = s1.angle + cosRot, r2 = s2.angle + cosRot;
            const x1 = cx + Math.cos(r1) * s1.dist * scale;
            const y1 = cy + Math.sin(r1) * s1.dist * s1.ySkew * scale;
            const x2 = cx + Math.cos(r2) * s2.dist * scale;
            const y2 = cy + Math.sin(r2) * s2.dist * s2.ySkew * scale;
            const d = Math.hypot(x2 - x1, y2 - y1);
            if (d < scale * 0.12) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(90, 110, 170, ${0.08 * a})`;
                ctx.stroke();
            }
        }

        // === Candlestick formations rising along walls ===
        const candleProg = smoothstep(0.04, 0.25, t);
        if (candleProg > 0) {
            for (let side = 0; side < 2; side++) {
                const baseX = side === 0 ? w * 0.03 : w * 0.87;
                const cScale = h * 0.28;
                for (let i = 0; i < candles.length; i++) {
                    const c = candles[i];
                    const cx_ = baseX + (i / candles.length) * w * 0.1;
                    const bTop = cy - (Math.max(c.open, c.close) - 0.35) * cScale;
                    const bBot = cy - (Math.min(c.open, c.close) - 0.35) * cScale;
                    const wTop = cy - (c.high - 0.35) * cScale;
                    const wBot = cy - (c.low - 0.35) * cScale;
                    const cA = candleProg * 0.35 * a;
                    const col = c.bullish ? `rgba(45, 200, 95, ${cA})` : `rgba(200, 45, 75, ${cA})`;

                    ctx.beginPath();
                    ctx.moveTo(cx_, wTop);
                    ctx.lineTo(cx_, wBot);
                    ctx.strokeStyle = col;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();

                    ctx.fillStyle = col;
                    ctx.fillRect(cx_ - 1.5, bTop, 3, Math.max(1, bBot - bTop));
                }
            }
        }

        // === Order books cascading as light columns ===
        const orderProg = smoothstep(0.08, 0.3, t);
        if (orderProg > 0) {
            for (const col of orderColumns) {
                const ox = cx + col.x * scale * 0.5;
                const pulse = 0.4 + 0.6 * Math.abs(Math.sin(elapsed * 0.002 * col.speed + col.phase));
                const oh = col.height * minDim * pulse;
                const oy = cy - oh;
                const oA = orderProg * 0.2 * a;

                const oG = ctx.createLinearGradient(ox, oy, ox, oy + oh);
                oG.addColorStop(0, `hsla(${col.hue}, 70%, 65%, ${oA})`);
                oG.addColorStop(1, `hsla(${col.hue}, 70%, 65%, 0)`);
                ctx.fillStyle = oG;
                ctx.fillRect(ox - col.width * minDim * 0.5, oy, col.width * minDim, oh);
            }
        }

        // === Currency-pair binary stars ===
        const pairProg = smoothstep(0.12, 0.35, t);
        if (pairProg > 0) {
            const pairs = [
                { x: 0.32, y: -0.22, h1: 200, h2: 45, p: 3800 },
                { x: -0.38, y: 0.18, h1: 150, h2: 305, p: 4800 },
                { x: 0.12, y: 0.38, h1: 28, h2: 185, p: 3200 },
                { x: -0.2, y: -0.35, h1: 60, h2: 240, p: 5500 }
            ];
            for (const pr of pairs) {
                const oa = (elapsed / pr.p) * Math.PI * 2;
                const oR = minDim * 0.022;
                const pcx = cx + pr.x * scale;
                const pcy = cy + pr.y * scale;
                const pA = pairProg * 0.65 * a;

                // Two orbiting stars
                for (let si = 0; si < 2; si++) {
                    const sign = si === 0 ? 1 : -1;
                    const sx = pcx + Math.cos(oa) * oR * sign;
                    const sy = pcy + Math.sin(oa) * oR * sign;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${si === 0 ? pr.h1 : pr.h2}, 80%, 62%, ${pA})`;
                    ctx.fill();
                }

                // Bid/ask spread glow
                const spPulse = 0.4 + 0.6 * Math.sin(elapsed * 0.004);
                const spG = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, oR * 3.5);
                spG.addColorStop(0, `rgba(255, 250, 200, ${pA * 0.08 * spPulse})`);
                spG.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = spG;
                ctx.beginPath();
                ctx.arc(pcx, pcy, oR * 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // === Derivative comets with volatility-surface tails ===
        const cometProg = smoothstep(0.18, 0.4, t);
        if (cometProg > 0) {
            for (const cm of comets) {
                const ca = cm.phase + elapsed * cm.speed;
                const cr = cm.radius * scale;
                const hx = cx + Math.cos(ca) * cr;
                const hy = cy + Math.sin(ca) * cr * (1 - cm.ecc * 0.45);

                ctx.beginPath();
                ctx.arc(hx, hy, 2, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${cm.hue}, 70%, 68%, ${cometProg * 0.55 * a})`;
                ctx.fill();

                // Tail
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                for (let ti = 1; ti <= cm.tailLen; ti++) {
                    const ta = ca - ti * cm.speed * 55;
                    ctx.lineTo(
                        cx + Math.cos(ta) * cr,
                        cy + Math.sin(ta) * cr * (1 - cm.ecc * 0.45)
                    );
                }
                ctx.strokeStyle = `hsla(${cm.hue}, 55%, 58%, ${cometProg * 0.12 * a})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // === Neural networks — translucent multi-layered organisms ===
        const neuralProg = smoothstep(0.1, 0.4, t);
        if (neuralProg > 0) {
            const nA = neuralProg * a;

            // Edges (connections)
            for (const e of neural.edges) {
                const n1 = neural.nodes[e.from], n2 = neural.nodes[e.to];
                const nx1 = cx + n1.x * scale * 0.65;
                const ny1 = cy + n1.y * scale * 0.65;
                const nx2 = cx + n2.x * scale * 0.65;
                const ny2 = cy + n2.y * scale * 0.65;
                const pulse = 0.25 + 0.75 * Math.abs(Math.sin(elapsed * 0.0018 + e.strength * 11));

                ctx.beginPath();
                ctx.moveTo(nx1, ny1);
                ctx.lineTo(nx2, ny2);
                ctx.strokeStyle = `rgba(95, 140, 255, ${nA * 0.12 * pulse * e.strength})`;
                ctx.lineWidth = 0.4 + e.strength;
                ctx.stroke();
            }

            // Nodes
            for (const nd of neural.nodes) {
                const nx = cx + nd.x * scale * 0.65;
                const ny = cy + nd.y * scale * 0.65;
                const pulse = 0.45 + 0.55 * Math.sin(elapsed * 0.0025 * nd.pulseSpeed + nd.pulsePhase);

                ctx.beginPath();
                ctx.arc(nx, ny, nd.size * pulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(110, 155, 255, ${nA * 0.28 * pulse})`;
                ctx.fill();

                const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nd.size * 3.5);
                ng.addColorStop(0, `rgba(95, 135, 255, ${nA * 0.12 * pulse})`);
                ng.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = ng;
                ctx.beginPath();
                ctx.arc(nx, ny, nd.size * 3.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Gradient-propagation shockwave
            const shockPeriod = 3200;
            const shockT = (elapsed % shockPeriod) / shockPeriod;
            if (shockT < 0.35) {
                const sr = shockT / 0.35 * scale * 0.75;
                const sA = (1 - shockT / 0.35) * 0.08 * nA;
                ctx.beginPath();
                ctx.arc(cx, cy, sr, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(145, 175, 255, ${sA})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // === Training data as interstellar gas clouds ===
        if (t > 0.15 && t < 0.75) {
            const clA = smoothstep(0.15, 0.3, t) * (1 - smoothstep(0.55, 0.75, t)) * 0.055 * a;
            for (let i = 0; i < 6; i++) {
                const clx = cx + Math.cos(i * 1.1 + elapsed * 0.00004) * scale * (0.55 + i * 0.08);
                const cly = cy + Math.sin(i * 1.5 + elapsed * 0.00004) * scale * (0.42 + i * 0.06);
                const clr = minDim * (0.04 + 0.025 * Math.sin(elapsed * 0.00025 + i));
                const cg = ctx.createRadialGradient(clx, cly, 0, clx, cly, clr);
                cg.addColorStop(0, `rgba(145, 95, 200, ${clA})`);
                cg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = cg;
                ctx.beginPath();
                ctx.arc(clx, cly, clr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // === HFT flashes (microsecond arcs) ===
        const hftProg = smoothstep(0.25, 0.45, t);
        if (hftProg > 0) {
            for (let f = 0; f < 7; f++) {
                const fp = ((elapsed * 0.012 + f * 173) % 120) / 120;
                if (fp > 0.08) continue;
                const fA = (1 - fp / 0.08) * hftProg * 0.55 * a;
                const fx1 = cx + Math.cos(f * 2.1 + elapsed * 0.0008) * scale * 0.28;
                const fy1 = cy + Math.sin(f * 2.9 + elapsed * 0.0008) * scale * 0.28;
                const fx2 = cx + Math.cos(f * 2.1 + elapsed * 0.0008 + 0.6) * scale * 0.52;
                const fy2 = cy + Math.sin(f * 2.9 + elapsed * 0.0008 + 0.6) * scale * 0.52;

                ctx.beginPath();
                ctx.moveTo(fx1, fy1);
                ctx.lineTo(fx2, fy2);
                ctx.strokeStyle = `rgba(255, 255, 190, ${fA})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }

        // === News-event bursts (ripples through cosmic mesh) ===
        const burstPeriod = 5500;
        const burstT = (elapsed % burstPeriod) / burstPeriod;
        if (burstT < 0.12 && t > 0.2) {
            const br = (burstT / 0.12) * scale * 0.55;
            const bA = (1 - burstT / 0.12) * 0.13 * a;
            const bx = cx + Math.cos(elapsed * 0.00008) * scale * 0.18;
            const by = cy + Math.sin(elapsed * 0.00008) * scale * 0.14;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 195, 90, ${bA})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // === Sentiment indicators (glowing/dimming regions) ===
        if (t > 0.25) {
            const sA = smoothstep(0.25, 0.45, t) * 0.045 * a;
            for (let i = 0; i < 4; i++) {
                const sentPulse = 0.3 + 0.7 * Math.sin(elapsed * 0.0008 + i * 2.5);
                const sx = cx + Math.cos(i * 1.6 + 0.5) * scale * 0.35;
                const sy = cy + Math.sin(i * 1.6 + 0.5) * scale * 0.3;
                const sr = minDim * 0.06;
                const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                sg.addColorStop(0, `rgba(255, 220, 100, ${sA * sentPulse})`);
                sg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // === Probabilistic halos (AI prediction outputs) ===
        if (t > 0.35) {
            const hA = smoothstep(0.35, 0.55, t) * 0.07 * a;
            for (let i = 0; i < 4; i++) {
                const hx = cx + Math.cos(i * 1.7 + 0.8) * scale * 0.28;
                const hy = cy + Math.sin(i * 1.7 + 0.8) * scale * 0.22;
                const hr = minDim * 0.055 + Math.sin(elapsed * 0.001 + i) * minDim * 0.015;
                const hg = ctx.createRadialGradient(hx, hy, hr * 0.25, hx, hy, hr);
                hg.addColorStop(0, `rgba(195, 175, 255, ${hA})`);
                hg.addColorStop(0.6, `rgba(145, 125, 220, ${hA * 0.4})`);
                hg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = hg;
                ctx.beginPath();
                ctx.arc(hx, hy, hr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // === Long-term investment theses: stable planetary systems ===
        if (t > 0.3) {
            const ltA = smoothstep(0.3, 0.5, t) * a;
            const systems = [
                { x: -0.28, y: 0.3, planets: 3, baseR: 0.04, col: 220 },
                { x: 0.35, y: -0.28, planets: 2, baseR: 0.035, col: 160 }
            ];
            for (const sys of systems) {
                const scx = cx + sys.x * scale;
                const scy = cy + sys.y * scale;
                // Central investment star
                ctx.beginPath();
                ctx.arc(scx, scy, 3, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${sys.col}, 70%, 70%, ${ltA * 0.6})`;
                ctx.fill();

                // Orbiting planets (slow, deliberate)
                for (let p = 0; p < sys.planets; p++) {
                    const pa = elapsed * 0.0002 * (1 + p * 0.3) + p * Math.PI * 2 / sys.planets;
                    const pr = (sys.baseR + p * 0.02) * scale;
                    // Orbit path
                    ctx.beginPath();
                    ctx.arc(scx, scy, pr, 0, Math.PI * 2);
                    ctx.strokeStyle = `hsla(${sys.col}, 50%, 50%, ${ltA * 0.08})`;
                    ctx.lineWidth = 0.4;
                    ctx.stroke();
                    // Planet
                    ctx.beginPath();
                    ctx.arc(scx + Math.cos(pa) * pr, scy + Math.sin(pa) * pr, 2, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${sys.col + 30}, 60%, 65%, ${ltA * 0.5})`;
                    ctx.fill();
                }
            }
        }

        ctx.restore();
    }

    // ================================================================
    //  PHASE 6 — Pull-back: cosmos framed in telescope aperture
    // ================================================================
    function drawPullback(t, elapsed) {
        const fadeIn = smoothstep(0, 0.08, t);
        const a = fadeIn;
        ctx.save();
        ctx.globalAlpha = a;

        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);

        // Disc radius — settles to framed size
        const discR = minDim * lerp(0.52, 0.32, easeInOut(t));

        // Dark mask outside disc
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.arc(cx, cy, discR, 0, Math.PI * 2, true);
        ctx.fillStyle = `rgba(5, 5, 5, ${a * 0.96})`;
        ctx.fill();

        // Soft vignette at disc edge
        const vg = ctx.createRadialGradient(cx, cy, discR * 0.82, cx, cy, discR);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(5, 5, 5, ${a * 0.45})`);
        ctx.fillStyle = vg;
        ctx.beginPath();
        ctx.arc(cx, cy, discR, 0, Math.PI * 2);
        ctx.fill();

        // Lens edge — polished metal ring
        ctx.beginPath();
        ctx.arc(cx, cy, discR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(105, 98, 86, ${a * 0.4})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Outer barrel ring
        ctx.beginPath();
        ctx.arc(cx, cy, discR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(68, 62, 55, ${a * 0.3})`;
        ctx.lineWidth = 9;
        ctx.stroke();

        // Dome reflection reappearing on lens surface
        if (t > 0.35) {
            const refA = smoothstep(0.35, 0.7, t) * 0.07 * a;
            ctx.beginPath();
            ctx.ellipse(cx, cy - discR * 0.28, discR * 0.55, discR * 0.12, 0, 0, Math.PI);
            ctx.strokeStyle = `rgba(115, 110, 95, ${refA})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Faint dome arch in reflection
            ctx.beginPath();
            ctx.ellipse(cx, cy - discR * 0.15, discR * 0.35, discR * 0.2, 0, Math.PI, 0);
            ctx.strokeStyle = `rgba(80, 75, 65, ${refA * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();

        // Final fade to dark (for transition)
        if (t > 0.82) {
            const ff = smoothstep(0.82, 1, t);
            ctx.fillStyle = `rgba(10, 10, 10, ${ff})`;
            ctx.fillRect(0, 0, w, h);
        }
    }

    // ================================================================
    //  Main render loop
    // ================================================================
    function render(timestamp) {
        if (skipped) return;
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;

        if (elapsed >= DURATION) {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, w, h);
            if (onComplete) onComplete();
            return;
        }

        // Clear
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        // Phase definitions [drawFn, startMs, endMs]
        const phases = [
            [drawObservatory, 0, 6000],
            [drawApproach, 5000, 12000],
            [drawOptics, 11000, 19500],
            [drawDataTransform, 18500, 26000],
            [drawCosmos, 25000, 38000],
            [drawPullback, 35500, 40000]
        ];

        for (const [fn, start, end] of phases) {
            if (elapsed >= start && elapsed <= end) {
                const t = (elapsed - start) / (end - start);
                fn(t, elapsed);
            }
        }

        animFrameId = requestAnimationFrame(render);
    }

    // ================================================================
    //  Public API
    // ================================================================
    return {
        start: function (canvasEl, completeFn) {
            canvas = canvasEl;
            ctx = canvas.getContext('2d');
            w = canvas.width;
            h = canvas.height;
            onComplete = completeFn;
            startTime = null;
            skipped = false;

            initParticles();
            animFrameId = requestAnimationFrame(render);
        },

        skip: function () {
            skipped = true;
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, w, h);
            if (onComplete) onComplete();
        },

        resize: function () {
            if (canvas) {
                w = canvas.width;
                h = canvas.height;
                initParticles();
            }
        },

        stop: function () {
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        }
    };
})();
