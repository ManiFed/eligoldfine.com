// Observatory Animation — Complete rewrite
// Continuous zoom from moonlit observatory → through telescope → into financial cosmos

const ObservatoryAnimation = (function () {
    let canvas, ctx, w, h;
    let startTime = null;
    let onComplete = null;
    let animFrameId = null;
    let skipped = false;

    const DURATION = 32000;

    // ── Utilities ──
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeIn(t) { return t * t * t; }
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function smoothstep(e0, e1, x) {
        const t = clamp((x - e0) / (e1 - e0), 0, 1);
        return t * t * (3 - 2 * t);
    }
    function seededRng(seed) {
        let s = seed;
        return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    }

    // ── Particle pools ──
    let dust, lensRings, stars, neural, candles, comets, orderCols, bgStars;

    function initParticles() {
        const r = seededRng(42);

        // Background stars (visible through dome slit & in cosmos)
        bgStars = [];
        for (let i = 0; i < 180; i++) {
            bgStars.push({
                x: r(), y: r() * 0.4,
                size: 0.3 + r() * 1.8,
                brightness: 0.4 + r() * 0.6,
                twinkle: r() * Math.PI * 2,
                speed: 0.5 + r() * 2
            });
        }

        // Dust motes
        dust = [];
        for (let i = 0; i < 300; i++) {
            dust.push({
                x: r(), y: r(),
                size: 0.5 + r() * 2.5,
                vx: (r() - 0.5) * 0.08,
                vy: -0.02 - r() * 0.06,
                opacity: 0.3 + r() * 0.7,
                phase: r() * Math.PI * 2
            });
        }

        // Lens elements for inside telescope
        lensRings = [];
        for (let i = 0; i < 12; i++) {
            lensRings.push({
                z: i * 0.09 + 0.03,
                radius: 0.13 + r() * 0.06,
                hue: 200 + i * 16,
                thickness: 1.5 + r() * 2.5,
                rotSpeed: (r() - 0.5) * 0.0006
            });
        }

        // Galaxy stars (financial cosmos)
        stars = [];
        for (let i = 0; i < 800; i++) {
            const arm = Math.floor(r() * 3);
            const armBase = arm * (Math.PI * 2 / 3);
            const dist = 0.015 + r() * 0.49;
            const spiral = armBase + dist * 4.5 + (r() - 0.5) * 0.55;
            const sec = Math.floor(r() * 4);
            let hue, sat;
            if (sec === 0) { hue = 215; sat = 90; }
            else if (sec === 1) { hue = 30; sat = 92; }
            else if (sec === 2) { hue = 150; sat = 75; }
            else { hue = 275; sat = 70; }
            stars.push({
                angle: spiral, dist,
                size: 0.4 + r() * 3,
                hue: hue + (r() - 0.5) * 22, sat,
                br: 0.2 + r() * 0.8,
                twPhase: r() * Math.PI * 2,
                twSpeed: 0.3 + r() * 2.5,
                ySkew: 0.45 + r() * 0.45
            });
        }

        // Neural network
        neural = { nodes: [], edges: [] };
        for (let i = 0; i < 55; i++) {
            neural.nodes.push({
                x: (r() - 0.5) * 0.95, y: (r() - 0.5) * 0.95,
                size: 2 + r() * 7,
                pPhase: r() * Math.PI * 2, pSpeed: 0.3 + r() * 1.8
            });
        }
        for (let i = 0; i < neural.nodes.length; i++)
            for (let j = i + 1; j < neural.nodes.length; j++) {
                const dx = neural.nodes[i].x - neural.nodes[j].x;
                const dy = neural.nodes[i].y - neural.nodes[j].y;
                if (Math.sqrt(dx * dx + dy * dy) < 0.26 && r() > 0.3)
                    neural.edges.push({ from: i, to: j, str: 0.25 + r() * 0.75 });
            }

        // Candlesticks
        candles = [];
        for (let i = 0; i < 80; i++) {
            const o = 0.3 + r() * 0.4, c = 0.3 + r() * 0.4;
            candles.push({
                open: o, close: c,
                high: Math.max(o, c) + r() * 0.08,
                low: Math.min(o, c) - r() * 0.08,
                bull: c > o
            });
        }

        // Comets
        comets = [];
        for (let i = 0; i < 12; i++) {
            comets.push({
                phase: r() * Math.PI * 2,
                speed: 0.0003 + r() * 0.0009,
                radius: 0.15 + r() * 0.35,
                ecc: 0.2 + r() * 0.5,
                hue: 165 + r() * 75,
                tail: 15 + r() * 35
            });
        }

        // Order columns
        orderCols = [];
        for (let i = 0; i < 45; i++) {
            orderCols.push({
                x: (r() - 0.5) * 1.8,
                height: 0.04 + r() * 0.28,
                width: 0.006 + r() * 0.014,
                hue: r() > 0.5 ? 135 : 355,
                speed: 0.4 + r() * 1.8,
                phase: r() * Math.PI * 2
            });
        }
    }

    // ── Global zoom: continuous forward motion throughout the animation ──
    // This single variable drives the fluid "flying through" feel
    function getZoom(elapsed) {
        const t = elapsed / DURATION;
        // Slow at start, accelerates in middle, slows at end
        if (t < 0.28) return 1 + easeIn(t / 0.28) * 14;         // 1 → 15
        if (t < 0.45) return 15 + easeInOut((t - 0.28) / 0.17) * 985; // 15 → 1000
        return 1000;
    }

    // ══════════════════════════════════════════════════════════════
    //  EXTERIOR OBSERVATORY SCENE — cinematic pan across the dome
    // ══════════════════════════════════════════════════════════════
    function drawExteriorObservatory(t, elapsed) {
        const fadeIn = smoothstep(0, 0.15, t);
        const fadeOut = 1 - smoothstep(0.82, 1, t);
        const a = fadeIn * fadeOut;
        if (a <= 0) return;

        const pan = easeInOut(Math.min(t / 0.9, 1));
        const driftY = Math.sin(elapsed * 0.00025) * 6;
        const cameraOffset = lerp(-w * 0.2, w * 0.05, pan);

        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(cameraOffset, driftY);

        const horizonY = h * 0.68;
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#f9a947');
        sky.addColorStop(0.35, '#f36b3a');
        sky.addColorStop(0.65, '#c43d5d');
        sky.addColorStop(1, '#2b1a3d');
        ctx.fillStyle = sky;
        ctx.fillRect(-w, 0, w * 3, h);

        for (let i = 0; i < 5; i++) {
            const cloudY = h * (0.08 + i * 0.08);
            const cloudWidth = w * (0.8 + Math.sin(elapsed * 0.00015 + i) * 0.1);
            const offset = Math.sin(elapsed * 0.0002 + i) * 80;
            const gradient = ctx.createLinearGradient(0, cloudY - 20, 0, cloudY + 30);
            gradient.addColorStop(0, `rgba(255, 200, 140, ${0.25 - i * 0.03})`);
            gradient.addColorStop(1, `rgba(255, 150, 110, ${0.12 - i * 0.02})`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(w * 0.4 + offset, cloudY, cloudWidth, 35, 0.15 - i * 0.05, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.moveTo(-w, horizonY + 40);
        for (let i = -1; i <= 5; i++) {
            const peakX = i * w * 0.35;
            const peakY = horizonY - 40 - Math.sin(i * 0.5 + elapsed * 0.0003) * 40;
            ctx.quadraticCurveTo(peakX + w * 0.12, peakY, peakX + w * 0.25, horizonY + 60);
        }
        ctx.lineTo(w * 2, h);
        ctx.lineTo(-w, h);
        ctx.closePath();
        const mountainGrad = ctx.createLinearGradient(0, horizonY - 80, 0, h);
        mountainGrad.addColorStop(0, 'rgba(35, 20, 40, 0.9)');
        mountainGrad.addColorStop(1, 'rgba(15, 10, 25, 1)');
        ctx.fillStyle = mountainGrad;
        ctx.fill();

        const domeBaseX = w * 0.55;
        const domeBaseY = horizonY - 35;
        const domeRadius = Math.min(w, h) * 0.22;
        const domeHeight = domeRadius * 0.92;

        ctx.beginPath();
        ctx.ellipse(domeBaseX, horizonY + 25, domeRadius * 1.2, domeRadius * 0.35, 0, 0, Math.PI * 2);
        const baseGrad = ctx.createLinearGradient(domeBaseX - domeRadius, horizonY - 20, domeBaseX + domeRadius, horizonY + 40);
        baseGrad.addColorStop(0, '#2f2f3b');
        baseGrad.addColorStop(1, '#1b1b24');
        ctx.fillStyle = baseGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.rect(domeBaseX - domeRadius * 1.1, horizonY - 20, domeRadius * 2.2, 60);
        const wallGrad = ctx.createLinearGradient(domeBaseX - domeRadius, horizonY - 40, domeBaseX + domeRadius, horizonY + 60);
        wallGrad.addColorStop(0, '#3d3d4b');
        wallGrad.addColorStop(0.5, '#2a2a35');
        wallGrad.addColorStop(1, '#17171f');
        ctx.fillStyle = wallGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(domeBaseX, domeBaseY, domeRadius, domeHeight, 0, Math.PI, 0);
        const domeGrad = ctx.createLinearGradient(domeBaseX - domeRadius, domeBaseY - domeHeight, domeBaseX + domeRadius, domeBaseY + domeHeight);
        domeGrad.addColorStop(0, '#d5d9e8');
        domeGrad.addColorStop(0.35, '#aeb7cc');
        domeGrad.addColorStop(0.7, '#7b8298');
        domeGrad.addColorStop(1, '#494d5d');
        ctx.fillStyle = domeGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(domeBaseX - domeRadius, domeBaseY);
        ctx.quadraticCurveTo(domeBaseX, domeBaseY + domeHeight * 0.85, domeBaseX + domeRadius, domeBaseY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 4;
        ctx.stroke();

        const slitWidth = domeRadius * 0.32;
        const slitOffset = Math.sin(elapsed * 0.0003) * domeRadius * 0.05;
        ctx.beginPath();
        ctx.moveTo(domeBaseX - slitWidth / 2 + slitOffset, domeBaseY);
        ctx.lineTo(domeBaseX - slitWidth / 2 + slitOffset, domeBaseY - domeHeight * 0.98);
        ctx.lineTo(domeBaseX + slitWidth / 2 + slitOffset, domeBaseY - domeHeight * 0.98);
        ctx.lineTo(domeBaseX + slitWidth / 2 + slitOffset, domeBaseY);
        ctx.closePath();
        const slitGrad = ctx.createLinearGradient(domeBaseX, domeBaseY - domeHeight, domeBaseX, domeBaseY);
        slitGrad.addColorStop(0, '#0a0f1c');
        slitGrad.addColorStop(1, '#202840');
        ctx.fillStyle = slitGrad;
        ctx.fill();

        const sunX = domeBaseX + slitWidth * 0.45 + slitOffset;
        const sunY = domeBaseY - domeHeight * 0.92;
        const sunRadius = Math.min(w, h) * 0.07;
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 3);
        sunGlow.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
        sunGlow.addColorStop(0.4, 'rgba(255, 183, 110, 0.4)');
        sunGlow.addColorStop(1, 'rgba(255, 120, 80, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 240, 195, 0.95)';
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius * 0.8, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 6; i++) {
            const rayAngle = (i / 6) * Math.PI * 2 + elapsed * 0.0002;
            ctx.beginPath();
            ctx.moveTo(sunX, sunY);
            ctx.lineTo(sunX + Math.cos(rayAngle) * sunRadius * 6, sunY + Math.sin(rayAngle) * sunRadius * 6);
            ctx.strokeStyle = 'rgba(255, 210, 140, 0.35)';
            ctx.lineWidth = 18;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.ellipse(domeBaseX, domeBaseY + domeHeight * 0.2, domeRadius * 1.1, domeHeight * 0.25, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(80, 80, 95, 0.8)';
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(domeBaseX, horizonY + 25, domeRadius * 1.3, domeRadius * 0.4, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(30, 30, 40, 0.8)';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.beginPath();
        for (let i = -6; i <= 6; i++) {
            const angle = (i / 6) * Math.PI;
            ctx.moveTo(domeBaseX + Math.cos(angle) * domeRadius * 1.3, horizonY + 15 + Math.sin(angle) * domeRadius * 0.2);
            ctx.lineTo(domeBaseX + Math.cos(angle) * domeRadius * 1.3, horizonY + 35 + Math.sin(angle) * domeRadius * 0.2);
        }
        ctx.strokeStyle = 'rgba(15, 15, 22, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const beam = ctx.createLinearGradient(sunX, sunY, sunX - domeRadius * 1.4, horizonY + 120);
        beam.addColorStop(0, 'rgba(255, 220, 160, 0.35)');
        beam.addColorStop(1, 'rgba(255, 170, 90, 0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(sunX - domeRadius * 1.2, horizonY + 40);
        ctx.lineTo(sunX - domeRadius * 1.4, horizonY + 120);
        ctx.lineTo(sunX - domeRadius * 0.4, horizonY + 60);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERIOR OBSERVATORY SCENE — moonlit dome with realistic telescope
    // ══════════════════════════════════════════════════════════════
    function drawInteriorObservatory(t, elapsed, zoom) {
        // t: 0→1 through this phase
        const fadeIn = smoothstep(0, 0.08, t);
        const fadeOut = 1 - smoothstep(0.75, 1, t);
        const a = fadeIn * fadeOut;
        if (a <= 0) return;

        ctx.save();
        ctx.globalAlpha = a;

        const cx = w / 2, cy = h / 2;

        // ── Deep blue ambient background (NOT black) ──
        const ambientG = ctx.createRadialGradient(cx, cy * 0.3, 0, cx, cy, Math.max(w, h) * 0.8);
        ambientG.addColorStop(0, '#141828');
        ambientG.addColorStop(0.4, '#0e1120');
        ambientG.addColorStop(1, '#08090f');
        ctx.fillStyle = ambientG;
        ctx.fillRect(0, 0, w, h);

        // ── Stars visible through dome slit ──
        for (const s of bgStars) {
            const sx = cx + (s.x - 0.5) * w * 0.12;
            const sy = s.y * h * 0.35;
            const tw = 0.5 + 0.5 * Math.sin(elapsed * 0.002 * s.speed + s.twinkle);
            ctx.beginPath();
            ctx.arc(sx, sy, s.size * tw, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220, 225, 255, ${s.brightness * tw * 0.8})`;
            ctx.fill();
        }

        // ── Dome — proper hemisphere with ribs and panels ──
        const domeX = cx, domeY = h * 0.48;
        const domeW = w * 0.52, domeH = h * 0.48;

        // Dome shell (filled, not just outline)
        ctx.beginPath();
        ctx.ellipse(domeX, domeY, domeW, domeH, 0, Math.PI, 0);
        ctx.lineTo(domeX + domeW, domeY);
        ctx.closePath();
        const domeG = ctx.createLinearGradient(domeX, domeY - domeH, domeX, domeY);
        domeG.addColorStop(0, 'rgba(35, 40, 55, 0.95)');
        domeG.addColorStop(0.5, 'rgba(28, 32, 45, 0.95)');
        domeG.addColorStop(1, 'rgba(22, 25, 38, 0.95)');
        ctx.fillStyle = domeG;
        ctx.fill();

        // Dome ribs (structural lines curving over the dome)
        for (let i = 0; i < 8; i++) {
            const ribAngle = Math.PI + (i / 8) * Math.PI;
            ctx.beginPath();
            for (let j = 0; j <= 20; j++) {
                const ja = Math.PI + (j / 20) * Math.PI;
                const rx = domeX + Math.cos(ja) * domeW;
                const ry = domeY + Math.sin(ja) * domeH;
                // Offset each rib along the dome surface
                const ribOffset = Math.sin(ribAngle) * 2;
                if (j === 0) ctx.moveTo(rx + ribOffset, ry);
                else ctx.lineTo(rx + ribOffset, ry);
            }
            ctx.strokeStyle = `rgba(50, 55, 72, ${0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Dome edge/base ring
        ctx.beginPath();
        ctx.moveTo(domeX - domeW, domeY);
        ctx.lineTo(domeX + domeW, domeY);
        ctx.strokeStyle = 'rgba(55, 60, 78, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // ── Dome slit (opening to sky) ──
        const slitW = w * 0.06;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - slitW, domeY);
        // Cut through the dome along the top
        for (let j = 0; j <= 30; j++) {
            const ja = Math.PI + (j / 30) * Math.PI;
            const rx = domeX + Math.cos(ja) * slitW;
            const ry = domeY + Math.sin(ja) * domeH;
            if (j === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
        }
        // Dark sky visible through slit
        ctx.fillStyle = '#080c18';
        ctx.fill();
        ctx.restore();

        // Slit edges (metal frame)
        for (const sign of [-1, 1]) {
            ctx.beginPath();
            for (let j = 0; j <= 30; j++) {
                const ja = Math.PI + (j / 30) * Math.PI;
                const rx = domeX + Math.cos(ja) * (slitW * sign);
                const ry = domeY + Math.sin(ja) * domeH;
                if (j === 0) ctx.moveTo(rx, ry);
                else ctx.lineTo(rx, ry);
            }
            ctx.strokeStyle = 'rgba(65, 72, 95, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // ── Moonlight beams through slit (bright, volumetric) ──
        const beamSpread = slitW * 2.5;
        const beamG = ctx.createLinearGradient(cx, domeY - domeH * 0.8, cx, h);
        beamG.addColorStop(0, 'rgba(140, 155, 200, 0.18)');
        beamG.addColorStop(0.3, 'rgba(130, 145, 190, 0.12)');
        beamG.addColorStop(0.6, 'rgba(120, 135, 180, 0.06)');
        beamG.addColorStop(1, 'rgba(110, 125, 170, 0)');

        ctx.beginPath();
        ctx.moveTo(cx - slitW * 0.8, domeY - domeH * 0.8);
        ctx.lineTo(cx - beamSpread, h);
        ctx.lineTo(cx + beamSpread, h);
        ctx.lineTo(cx + slitW * 0.8, domeY - domeH * 0.8);
        ctx.closePath();
        ctx.fillStyle = beamG;
        ctx.fill();

        // Second pass — brighter core beam
        const beam2G = ctx.createLinearGradient(cx, domeY - domeH * 0.8, cx, h * 0.9);
        beam2G.addColorStop(0, 'rgba(160, 175, 220, 0.12)');
        beam2G.addColorStop(0.5, 'rgba(140, 155, 200, 0.05)');
        beam2G.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.moveTo(cx - slitW * 0.4, domeY - domeH * 0.7);
        ctx.lineTo(cx - beamSpread * 0.5, h * 0.95);
        ctx.lineTo(cx + beamSpread * 0.5, h * 0.95);
        ctx.lineTo(cx + slitW * 0.4, domeY - domeH * 0.7);
        ctx.closePath();
        ctx.fillStyle = beam2G;
        ctx.fill();

        // ── Dust particles (bright, clearly visible in beams) ──
        for (const p of dust) {
            const px = (p.x * w + Math.sin(elapsed * 0.0003 + p.phase) * 25 + p.vx * elapsed * 0.02) % w;
            const py = (p.y * h + elapsed * p.vy * 0.02 + h) % h;

            // Brightness depends on whether particle is in beam
            const distFromCenter = Math.abs(px - cx) / beamSpread;
            const inBeam = distFromCenter < 1 && py > (domeY - domeH * 0.5) && py < h * 0.9;
            const beamMul = inBeam ? (1 - distFromCenter) * 2.5 : 0.15;
            const flicker = 0.6 + 0.4 * Math.sin(elapsed * 0.0015 + p.phase);

            const alpha = p.opacity * flicker * beamMul;
            if (alpha < 0.02) continue;

            ctx.beginPath();
            ctx.arc(px, py, p.size * (inBeam ? 1.3 : 0.7), 0, Math.PI * 2);
            ctx.fillStyle = inBeam
                ? `rgba(200, 210, 240, ${clamp(alpha, 0, 1)})`
                : `rgba(120, 125, 150, ${clamp(alpha * 0.5, 0, 0.3)})`;
            ctx.fill();

            // Glow on bright dust
            if (alpha > 0.5 && inBeam) {
                ctx.beginPath();
                ctx.arc(px, py, p.size * 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180, 190, 230, ${alpha * 0.1})`;
                ctx.fill();
            }
        }

        // ── Floor ──
        const floorY = h * 0.78;
        const floorG = ctx.createLinearGradient(0, floorY, 0, h);
        floorG.addColorStop(0, 'rgba(18, 20, 30, 0.9)');
        floorG.addColorStop(1, 'rgba(12, 14, 22, 0.95)');
        ctx.fillStyle = floorG;
        ctx.fillRect(0, floorY, w, h - floorY);

        // Floor edge line
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(w, floorY);
        ctx.strokeStyle = 'rgba(45, 50, 68, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Moonlight pool on floor
        const poolG = ctx.createRadialGradient(cx, floorY + 20, 0, cx, floorY + 20, beamSpread * 1.2);
        poolG.addColorStop(0, 'rgba(100, 115, 170, 0.08)');
        poolG.addColorStop(0.5, 'rgba(80, 95, 150, 0.03)');
        poolG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = poolG;
        ctx.fillRect(cx - beamSpread * 1.5, floorY, beamSpread * 3, h - floorY);

        // ── TELESCOPE — realistic refractor on equatorial mount ──
        const teleY = h * 0.54;
        const tLen = w * 0.38;
        const tubeR = Math.min(w, h) * 0.035; // tube radius
        const tilt = -0.06;

        ctx.save();
        ctx.translate(cx, teleY);
        ctx.rotate(tilt);

        // -- Mount pier --
        ctx.beginPath();
        ctx.moveTo(-8, tubeR + 15);
        ctx.lineTo(-12, floorY - teleY - 5);
        ctx.lineTo(12, floorY - teleY - 5);
        ctx.lineTo(8, tubeR + 15);
        ctx.closePath();
        const pierG = ctx.createLinearGradient(-12, tubeR, 12, floorY - teleY);
        pierG.addColorStop(0, 'rgba(50, 55, 70, 0.9)');
        pierG.addColorStop(1, 'rgba(35, 38, 52, 0.9)');
        ctx.fillStyle = pierG;
        ctx.fill();
        ctx.strokeStyle = 'rgba(65, 70, 88, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // -- Tripod legs --
        for (const angle of [-0.45, 0, 0.45]) {
            const legX = Math.sin(angle) * (floorY - teleY) * 0.35;
            ctx.beginPath();
            ctx.moveTo(0, floorY - teleY - 15);
            ctx.lineTo(legX, floorY - teleY - 5);
            ctx.strokeStyle = 'rgba(48, 52, 68, 0.7)';
            ctx.lineWidth = 5;
            ctx.stroke();
        }

        // -- Mount head (GEM shape) --
        ctx.beginPath();
        ctx.ellipse(0, tubeR + 12, 18, 10, 0, 0, Math.PI * 2);
        const mountG = ctx.createRadialGradient(0, tubeR + 8, 0, 0, tubeR + 12, 20);
        mountG.addColorStop(0, 'rgba(70, 75, 95, 0.95)');
        mountG.addColorStop(1, 'rgba(45, 48, 65, 0.95)');
        ctx.fillStyle = mountG;
        ctx.fill();
        ctx.strokeStyle = 'rgba(85, 90, 110, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // -- Counterweight shaft --
        ctx.beginPath();
        ctx.moveTo(0, tubeR + 10);
        ctx.lineTo(-tLen * 0.12, tubeR + tLen * 0.2);
        ctx.strokeStyle = 'rgba(55, 58, 75, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Counterweight
        ctx.beginPath();
        ctx.ellipse(-tLen * 0.12, tubeR + tLen * 0.2, 10, 14, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(50, 55, 72, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(70, 75, 95, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // -- Main tube — cylindrical shading with highlight band --
        // Top edge of tube
        const drawTubeSection = (x1, x2, r1, r2, topColor, midColor, botColor, highlightStr) => {
            // Body with cylindrical gradient (top highlight for moonlight)
            const tubeBodyG = ctx.createLinearGradient(0, -r1, 0, r1);
            tubeBodyG.addColorStop(0, topColor);
            tubeBodyG.addColorStop(0.3, midColor);
            tubeBodyG.addColorStop(0.5, midColor);
            tubeBodyG.addColorStop(1, botColor);

            ctx.beginPath();
            ctx.moveTo(x1, -r1);
            ctx.lineTo(x2, -r2);
            ctx.lineTo(x2, r2);
            ctx.lineTo(x1, r1);
            ctx.closePath();
            ctx.fillStyle = tubeBodyG;
            ctx.fill();

            // Highlight band (moonlight reflection along top of tube)
            ctx.beginPath();
            ctx.moveTo(x1, -r1 + 2);
            ctx.lineTo(x2, -r2 + 2);
            ctx.strokeStyle = `rgba(140, 155, 200, ${highlightStr})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Bottom shadow edge
            ctx.beginPath();
            ctx.moveTo(x1, r1);
            ctx.lineTo(x2, r2);
            ctx.strokeStyle = 'rgba(15, 16, 25, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        // Dew shield (wider section at objective end)
        const dewLen = tLen * 0.15;
        const dewR = tubeR * 1.35;
        drawTubeSection(
            tLen / 2 - dewLen, tLen / 2, dewR, dewR,
            'rgba(65, 72, 92, 0.95)', 'rgba(42, 48, 65, 0.95)', 'rgba(28, 32, 48, 0.95)', 0.35
        );

        // Main tube body
        drawTubeSection(
            -tLen / 2 + tLen * 0.08, tLen / 2 - dewLen, tubeR, tubeR,
            'rgba(70, 78, 100, 0.95)', 'rgba(48, 55, 75, 0.95)', 'rgba(30, 35, 52, 0.95)', 0.3
        );

        // Focuser drawtube (eyepiece end — slightly thinner, shorter)
        const focLen = tLen * 0.08;
        const focR = tubeR * 0.65;
        drawTubeSection(
            -tLen / 2, -tLen / 2 + focLen, focR, tubeR * 0.85,
            'rgba(62, 68, 88, 0.95)', 'rgba(45, 50, 68, 0.95)', 'rgba(30, 34, 50, 0.95)', 0.25
        );

        // Tube rings (decorative bands along the tube)
        for (let i = 0; i < 5; i++) {
            const rx = -tLen / 2 + focLen + (i + 0.5) * (tLen - focLen - dewLen) / 5;
            ctx.beginPath();
            ctx.moveTo(rx, -tubeR - 1);
            ctx.lineTo(rx, tubeR + 1);
            ctx.strokeStyle = 'rgba(80, 88, 110, 0.35)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // -- Finder scope (small tube on top) --
        const finderY = -tubeR - 6;
        const finderLen = tLen * 0.2;
        const finderR = 3;
        ctx.beginPath();
        ctx.rect(tLen * 0.05, finderY - finderR, finderLen, finderR * 2);
        const finderG = ctx.createLinearGradient(0, finderY - finderR, 0, finderY + finderR);
        finderG.addColorStop(0, 'rgba(75, 82, 105, 0.9)');
        finderG.addColorStop(0.3, 'rgba(55, 62, 82, 0.9)');
        finderG.addColorStop(1, 'rgba(35, 40, 58, 0.9)');
        ctx.fillStyle = finderG;
        ctx.fill();

        // Finder bracket
        ctx.beginPath();
        ctx.moveTo(tLen * 0.1, finderY + finderR);
        ctx.lineTo(tLen * 0.1, -tubeR);
        ctx.moveTo(tLen * 0.18, finderY + finderR);
        ctx.lineTo(tLen * 0.18, -tubeR);
        ctx.strokeStyle = 'rgba(65, 72, 92, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // -- Eyepiece (at the focuser end) --
        ctx.beginPath();
        ctx.ellipse(-tLen / 2 - 2, 0, focR + 2, focR + 2, 0, 0, Math.PI * 2);
        const epG = ctx.createRadialGradient(-tLen / 2 - 2, -focR * 0.3, 0, -tLen / 2 - 2, 0, focR + 4);
        epG.addColorStop(0, 'rgba(30, 35, 55, 0.95)');
        epG.addColorStop(0.6, 'rgba(18, 22, 38, 0.95)');
        epG.addColorStop(1, 'rgba(55, 62, 82, 0.8)');
        ctx.fillStyle = epG;
        ctx.fill();
        ctx.strokeStyle = 'rgba(80, 88, 110, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glass surface of eyepiece (slight reflection)
        ctx.beginPath();
        ctx.ellipse(-tLen / 2 - 2, 0, focR * 0.6, focR * 0.6, 0, 0, Math.PI * 2);
        const glassEP = ctx.createRadialGradient(-tLen / 2 - 2, -focR * 0.2, 0, -tLen / 2 - 2, 0, focR * 0.6);
        glassEP.addColorStop(0, 'rgba(60, 70, 110, 0.3)');
        glassEP.addColorStop(0.5, 'rgba(25, 30, 50, 0.2)');
        glassEP.addColorStop(1, 'rgba(15, 18, 35, 0.1)');
        ctx.fillStyle = glassEP;
        ctx.fill();

        // -- Objective lens (far end — star caught in it) --
        ctx.beginPath();
        ctx.ellipse(tLen / 2 + 1, 0, dewR, dewR, 0, 0, Math.PI * 2);
        const objG = ctx.createRadialGradient(tLen / 2 + 1, -dewR * 0.2, 0, tLen / 2 + 1, 0, dewR);
        objG.addColorStop(0, 'rgba(25, 30, 55, 0.6)');
        objG.addColorStop(0.7, 'rgba(15, 20, 40, 0.8)');
        objG.addColorStop(1, 'rgba(60, 68, 90, 0.5)');
        ctx.fillStyle = objG;
        ctx.fill();

        // Star caught in objective lens
        const starG = ctx.createRadialGradient(tLen / 2 + 1, 0, 0, tLen / 2 + 1, 0, dewR * 2);
        starG.addColorStop(0, 'rgba(230, 240, 255, 0.85)');
        starG.addColorStop(0.04, 'rgba(200, 215, 255, 0.6)');
        starG.addColorStop(0.15, 'rgba(140, 160, 230, 0.2)');
        starG.addColorStop(0.4, 'rgba(80, 100, 180, 0.05)');
        starG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = starG;
        ctx.fillRect(tLen / 2 - dewR * 2, -dewR * 2, dewR * 4, dewR * 4);

        // Diffraction spikes on the star
        ctx.save();
        ctx.translate(tLen / 2 + 1, 0);
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(dewR * 1.5, 0);
            ctx.strokeStyle = 'rgba(200, 215, 255, 0.15)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-dewR * 1.5, 0);
            ctx.stroke();
        }
        ctx.restore();

        ctx.restore(); // end telescope transform

        // ── Subtle red pilot light (common in observatories) ──
        const pilotX = w * 0.15, pilotY = floorY - 15;
        const pilotG = ctx.createRadialGradient(pilotX, pilotY, 0, pilotX, pilotY, 40);
        pilotG.addColorStop(0, 'rgba(200, 50, 30, 0.15)');
        pilotG.addColorStop(0.1, 'rgba(180, 40, 25, 0.08)');
        pilotG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pilotG;
        ctx.fillRect(pilotX - 40, pilotY - 40, 80, 80);
        ctx.beginPath();
        ctx.arc(pilotX, pilotY, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 60, 30, 0.8)';
        ctx.fill();

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    //  APPROACH EYEPIECE — continuous zoom into the telescope
    // ══════════════════════════════════════════════════════════════
    function drawApproach(t, elapsed) {
        const fadeIn = smoothstep(0, 0.1, t);
        const fadeOut = 1 - smoothstep(0.85, 1, t);
        const a = fadeIn * fadeOut;
        if (a <= 0) return;

        ctx.save();
        ctx.globalAlpha = a;

        const cx = w / 2, cy = h / 2;
        const maxR = Math.hypot(w, h) * 0.62;
        const minR = Math.min(w, h) * 0.035;
        // Smooth growth using easeInOut for natural feel
        const radius = lerp(minR, maxR, easeInOut(t));

        // Background — deep blue, not black
        ctx.fillStyle = '#0a0c18';
        ctx.fillRect(0, 0, w, h);

        // Outer barrel darkness (everything outside eyepiece)
        if (radius < maxR * 0.99) {
            ctx.beginPath();
            ctx.rect(0, 0, w, h);
            ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
            ctx.fillStyle = '#060810';
            ctx.fill();
        }

        // Eyepiece glass — dark with subtle blue tint and reflection
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        const glassG = ctx.createRadialGradient(cx - radius * 0.12, cy - radius * 0.12, 0, cx, cy, radius);
        glassG.addColorStop(0, 'rgba(22, 28, 45, 0.95)');
        glassG.addColorStop(0.5, 'rgba(14, 18, 32, 0.98)');
        glassG.addColorStop(0.9, 'rgba(10, 14, 28, 1)');
        glassG.addColorStop(1, 'rgba(35, 42, 65, 0.8)');
        ctx.fillStyle = glassG;
        ctx.fill();

        // Metallic edge ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        const edgeG = ctx.createRadialGradient(cx, cy, radius - 4, cx, cy, radius + 2);
        edgeG.addColorStop(0, 'rgba(60, 68, 90, 0)');
        edgeG.addColorStop(0.5, 'rgba(90, 98, 125, 0.6)');
        edgeG.addColorStop(1, 'rgba(50, 55, 75, 0.3)');
        ctx.strokeStyle = 'rgba(100, 108, 135, 0.55)';
        ctx.lineWidth = clamp(2 + t * 4, 1.5, 6);
        ctx.stroke();

        // Concentric metallic rings inside
        for (let i = 0; i < 8; i++) {
            const rr = radius * (0.2 + i * 0.1);
            if (rr < 2) continue;
            const ringA = 0.15 + 0.1 * Math.sin(elapsed * 0.0008 + i * 0.8);
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(110, 118, 148, ${ringA})`;
            ctx.lineWidth = clamp(0.8 + t * 2, 0.5, 3.5);
            ctx.stroke();
        }

        // Dome reflection on glass (fades as we approach)
        if (t < 0.5) {
            const refA = (1 - t / 0.5) * 0.2;
            // Curved highlight — dome reflection
            ctx.beginPath();
            ctx.ellipse(cx - radius * 0.15, cy - radius * 0.25, radius * 0.4, radius * 0.12, -0.2, 0, Math.PI);
            ctx.strokeStyle = `rgba(120, 130, 165, ${refA})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            // Secondary reflection
            ctx.beginPath();
            ctx.ellipse(cx + radius * 0.2, cy + radius * 0.15, radius * 0.15, radius * 0.05, 0.3, 0, Math.PI);
            ctx.strokeStyle = `rgba(100, 110, 145, ${refA * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Machining grooves (fine concentric lines mid-approach)
        if (t > 0.3 && t < 0.8) {
            const gA = smoothstep(0.3, 0.5, t) * (1 - smoothstep(0.65, 0.8, t)) * 0.22;
            for (let i = 0; i < 30; i++) {
                const gr = radius * (0.82 + i * 0.006);
                if (gr >= radius) continue;
                ctx.beginPath();
                ctx.arc(cx, cy, gr, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(90, 98, 125, ${gA})`;
                ctx.lineWidth = 0.35;
                ctx.stroke();
            }
        }

        // Rubber eyecup (stretches past screen edges)
        if (t > 0.7) {
            const cupA = smoothstep(0.7, 0.88, t);
            const cupW = radius * 0.065;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.arc(cx, cy, radius - cupW, 0, Math.PI * 2, true);
            ctx.fillStyle = `rgba(18, 20, 28, ${cupA})`;
            ctx.fill();

            // Texture ridges
            const step = Math.max(0.012, 0.05 / (1 + t * 0.5));
            for (let ang = 0; ang < Math.PI * 2; ang += step) {
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(ang) * (radius - cupW), cy + Math.sin(ang) * (radius - cupW));
                ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
                ctx.strokeStyle = `rgba(28, 30, 40, ${cupA * 0.35})`;
                ctx.lineWidth = 0.4;
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    //  INSIDE TELESCOPE — corridor of optical elements
    // ══════════════════════════════════════════════════════════════
    function drawOptics(t, elapsed) {
        const fadeIn = smoothstep(0, 0.07, t);
        const fadeOut = 1 - smoothstep(0.88, 1, t);
        const a = fadeIn * fadeOut;
        if (a <= 0) return;

        ctx.save();
        ctx.globalAlpha = a;

        // Slightly blue-tinted darkness
        ctx.fillStyle = '#04060f';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);
        const camZ = t * 10;

        // ── Tube interior walls (barely visible barrel) ──
        const barrelR = minDim * 0.48;
        const barrelG = ctx.createRadialGradient(cx, cy, barrelR * 0.85, cx, cy, barrelR);
        barrelG.addColorStop(0, 'rgba(0,0,0,0)');
        barrelG.addColorStop(0.7, 'rgba(20, 25, 40, 0.1)');
        barrelG.addColorStop(1, 'rgba(30, 38, 60, 0.25)');
        ctx.fillStyle = barrelG;
        ctx.fillRect(0, 0, w, h);

        // ── Lens elements floating in sequence ──
        for (const ring of lensRings) {
            const relZ = ring.z * 10 - camZ;
            if (relZ < 0.05 || relZ > 4) continue;
            const persp = 1 / relZ;
            const sr = ring.radius * minDim * persp;
            if (sr < 1 || sr > minDim * 3) continue;

            const rot = elapsed * ring.rotSpeed;

            // Lens glass — visible, with edge glow
            ctx.beginPath();
            ctx.arc(cx, cy, sr, 0, Math.PI * 2);
            const lg = ctx.createRadialGradient(cx, cy, sr * 0.5, cx, cy, sr);
            lg.addColorStop(0, `rgba(15, 20, 40, ${0.1 * Math.min(1, persp * 0.5)})`);
            lg.addColorStop(0.8, `rgba(35, 45, 80, ${0.3 * Math.min(1, persp * 0.6)})`);
            lg.addColorStop(1, `rgba(100, 115, 170, ${0.5 * Math.min(1, persp * 0.7)})`);
            ctx.fillStyle = lg;
            ctx.fill();
            ctx.strokeStyle = `rgba(140, 155, 200, ${0.45 * Math.min(1, persp * 0.7)})`;
            ctx.lineWidth = ring.thickness * persp;
            ctx.stroke();

            // Prismatic refraction — vivid rainbow bands
            const hues = [0, 30, 55, 120, 200, 275];
            for (let b = 0; b < 6; b++) {
                const ba = rot + (b / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(
                    cx + Math.cos(ba) * sr * 0.1,
                    cy + Math.sin(ba) * sr * 0.1,
                    sr * 0.4, ba - 0.4, ba + 0.4
                );
                ctx.strokeStyle = `hsla(${hues[b]}, 90%, 65%, ${0.2 * Math.min(1, persp * 0.5)})`;
                ctx.lineWidth = sr * 0.05;
                ctx.stroke();
            }
        }

        // ── Chromatic aberration — blue/red at edges (stronger) ──
        const abStr = 3 + t * 8;
        ctx.beginPath();
        ctx.arc(cx, cy, minDim * 0.46, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80, 100, 255, ${0.12})`;
        ctx.lineWidth = abStr;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, minDim * 0.465, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 80, 80, ${0.08})`;
        ctx.lineWidth = abStr * 0.6;
        ctx.stroke();

        // ── Ghost images (brighter, more visible) ──
        for (let g = 0; g < 5; g++) {
            const gPhase = (elapsed * 0.0005 + g * 1.3) % 3;
            const gr = minDim * (0.03 + gPhase * 0.05);
            const gx = cx + Math.cos(elapsed * 0.0003 + g * 1.4) * minDim * 0.1;
            const gy = cy + Math.sin(elapsed * 0.0004 + g * 1.8) * minDim * 0.08;
            const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            gg.addColorStop(0, `rgba(150, 170, 255, ${0.1})`);
            gg.addColorStop(0.5, `rgba(100, 120, 210, ${0.04})`);
            gg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── Mechanical baffles ──
        if (t > 0.2) {
            const mA = smoothstep(0.2, 0.4, t);
            for (let b = 0; b < 6; b++) {
                const bz = 0.2 + b * 0.13 - (camZ % 0.8);
                if (bz < 0.06 || bz > 1.5) continue;
                const bp = 1 / bz;
                const br = minDim * 0.38 * bp;
                if (br > minDim) continue;
                ctx.beginPath();
                ctx.arc(cx, cy, br, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(35, 40, 58, ${mA * 0.6 * Math.min(1, bp * 0.4)})`;
                ctx.lineWidth = 8 * bp;
                ctx.stroke();

                // Inner lip of baffle
                ctx.beginPath();
                ctx.arc(cx, cy, br * 0.92, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(45, 52, 72, ${mA * 0.3 * Math.min(1, bp * 0.3)})`;
                ctx.lineWidth = 2 * bp;
                ctx.stroke();
            }

            // Adjustment screws on baffles
            for (let s = 0; s < 6; s++) {
                const sa = s * Math.PI / 3 + elapsed * 0.00008;
                const sr_ = minDim * 0.3;
                ctx.beginPath();
                ctx.arc(cx + Math.cos(sa) * sr_, cy + Math.sin(sa) * sr_, 4, 0, Math.PI * 2);
                const screwG = ctx.createRadialGradient(
                    cx + Math.cos(sa) * sr_ - 1, cy + Math.sin(sa) * sr_ - 1, 0,
                    cx + Math.cos(sa) * sr_, cy + Math.sin(sa) * sr_, 5
                );
                screwG.addColorStop(0, `rgba(90, 100, 130, ${mA * 0.5})`);
                screwG.addColorStop(1, `rgba(40, 45, 65, ${mA * 0.3})`);
                ctx.fillStyle = screwG;
                ctx.fill();
            }

            // Focusing rails
            const rA = smoothstep(0.3, 0.5, t) * 0.35;
            for (let r = -3; r <= 3; r++) {
                if (r === 0) continue;
                ctx.beginPath();
                ctx.moveTo(cx - minDim * 0.4, cy + r * minDim * 0.09);
                ctx.lineTo(cx + minDim * 0.4, cy + r * minDim * 0.09);
                ctx.strokeStyle = `rgba(55, 62, 85, ${rA})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }

        // ── Wireframe grid emerging (transition to abstract) ──
        if (t > 0.65) {
            const wfA = smoothstep(0.65, 0.88, t) * 0.45;
            for (let i = -10; i <= 10; i++) {
                const off = i * minDim * 0.042;
                ctx.beginPath();
                ctx.moveTo(cx + off, cy - minDim * 0.42);
                ctx.lineTo(cx + off, cy + minDim * 0.42);
                ctx.strokeStyle = `rgba(80, 120, 230, ${wfA})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx - minDim * 0.42, cy + off);
                ctx.lineTo(cx + minDim * 0.42, cy + off);
                ctx.strokeStyle = `rgba(80, 120, 230, ${wfA})`;
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    //  DATA TRANSFORMATION — wireframe → coordinates → data tunnel
    // ══════════════════════════════════════════════════════════════
    function drawDataTransform(t, elapsed) {
        const fadeIn = smoothstep(0, 0.2, t);
        const fadeOut = 1 - smoothstep(0.92, 1, t);
        const a = fadeIn * fadeOut;
        if (a <= 0) return;

        ctx.save();
        ctx.globalAlpha = a;

        ctx.fillStyle = '#040610';
        ctx.fillRect(0, 0, w, h);

        if (t < 0.3) {
            const carry = (0.3 - t) / 0.3;
            const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
            glow.addColorStop(0, `rgba(40, 60, 120, ${carry * 0.3})`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);
        }

        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);

        const gridP = smoothstep(0, 0.3, t);
        const axesP = smoothstep(0.12, 0.45, t);
        const dataP = smoothstep(0.3, 0.65, t);
        const tunnelP = smoothstep(0.5, 1, t);

        // ── Perspective grid ──
        if (gridP > 0) {
            const gA = gridP * 0.35;
            const vanY = cy * 0.3;
            for (let i = 0; i < 24; i++) {
                const gy = lerp(vanY, h * 0.96, Math.pow(i / 24, 1.5));
                const spr = (gy - vanY) / (h * 0.96 - vanY);
                ctx.beginPath();
                ctx.moveTo(cx - spr * w * 0.58, gy);
                ctx.lineTo(cx + spr * w * 0.58, gy);
                ctx.strokeStyle = `rgba(60, 85, 220, ${gA * spr})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }
            for (let i = -14; i <= 14; i++) {
                ctx.beginPath();
                ctx.moveTo(cx, vanY);
                ctx.lineTo(cx + i * w * 0.045, h * 0.96);
                ctx.strokeStyle = `rgba(60, 85, 220, ${gA * 0.5})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
            }
        }

        // ── Coordinate axes (brighter, thicker) ──
        if (axesP > 0) {
            const aA = axesP * 0.7;
            ctx.lineWidth = 2;
            // X — time
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.4 * axesP, cy);
            ctx.lineTo(cx + w * 0.4 * axesP, cy);
            ctx.strokeStyle = `rgba(100, 180, 255, ${aA})`;
            ctx.stroke();
            // Y — value
            ctx.beginPath();
            ctx.moveTo(cx, cy + h * 0.36 * axesP);
            ctx.lineTo(cx, cy - h * 0.36 * axesP);
            ctx.strokeStyle = `rgba(100, 255, 160, ${aA})`;
            ctx.stroke();
            // Z — probability
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.2 * axesP, cy + h * 0.2 * axesP);
            ctx.lineTo(cx + w * 0.2 * axesP, cy - h * 0.2 * axesP);
            ctx.strokeStyle = `rgba(255, 160, 100, ${aA})`;
            ctx.stroke();

            // Axis labels
            if (axesP > 0.4) {
                const lA = (axesP - 0.4) / 0.6;
                const fs = Math.round(clamp(13 * (minDim / 800), 10, 18));
                ctx.font = `${fs}px monospace`;
                ctx.fillStyle = `rgba(100, 180, 255, ${lA})`;
                ctx.fillText('TIME', cx + w * 0.34, cy + 20);
                ctx.fillStyle = `rgba(100, 255, 160, ${lA})`;
                ctx.fillText('VALUE', cx + 10, cy - h * 0.31);
                ctx.fillStyle = `rgba(255, 160, 100, ${lA})`;
                ctx.fillText('PROBABILITY', cx + w * 0.13, cy - h * 0.14);
            }
        }

        // ── Streaming numbers ──
        if (dataP > 0) {
            const fs = Math.round(clamp(11 * (minDim / 800), 8, 15));
            ctx.font = `${fs}px monospace`;
            const nA = dataP * 0.6;
            for (let i = 0; i < 40; i++) {
                const ft = ((elapsed * 0.0009 + i * 0.26) % 2.6) / 2.6;
                const fx = cx + (ft - 0.5) * w * 0.72;
                const fy = cy + Math.sin(ft * Math.PI * 2 + i) * 7;
                const val = (Math.sin(elapsed * 0.0009 + i * 7.1) * 100).toFixed(2);
                const fade = 1 - Math.abs(ft - 0.5) * 2;
                ctx.fillStyle = `rgba(150, 205, 255, ${nA * fade})`;
                ctx.fillText(val, fx, fy);
            }
            for (let i = 0; i < 24; i++) {
                const ft = ((elapsed * 0.0007 + i * 0.32) % 3) / 3;
                const fy = cy + (ft - 0.5) * h * 0.64;
                const fx = cx + Math.cos(ft * Math.PI * 2 + i * 2) * 10;
                const val = (Math.sin(elapsed * 0.001 + i * 3.5) * 50).toFixed(1);
                const fade = 1 - Math.abs(ft - 0.5) * 2;
                ctx.fillStyle = `rgba(150, 255, 180, ${nA * 0.75 * fade})`;
                ctx.fillText(val, fx, fy);
            }
        }

        // ── Data tunnel ──
        if (tunnelP > 0) {
            const tA = tunnelP;
            for (let ring = 0; ring < 20; ring++) {
                const rz = ((ring * 0.16 + elapsed * 0.001) % 3.5);
                if (rz < 0.06) continue;
                const persp = 1 / rz;
                const rr = minDim * 0.44 * persp;
                if (rr > minDim * 1.2) continue;

                ctx.beginPath();
                ctx.arc(cx, cy, rr, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(80, 125, 255, ${tA * 0.22 * Math.min(1, persp * 0.35)})`;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                for (let s = 0; s < 8; s++) {
                    const sa = s * Math.PI / 4 + rz * 2;
                    const sx = cx + Math.cos(sa) * rr;
                    const sy = cy + Math.sin(sa) * rr;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 2 * persp, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(130, 175, 255, ${tA * 0.25 * persp})`;
                    ctx.fill();
                }
            }
        }

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    //  FINANCIAL COSMOS
    // ══════════════════════════════════════════════════════════════
    function drawCosmos(t, elapsed) {
        const fadeIn = smoothstep(0, 0.05, t);
        const fadeOut = 1 - smoothstep(0.92, 1, t);
        const a = fadeIn * fadeOut;
        if (a <= 0) return;

        ctx.save();
        ctx.globalAlpha = a;

        // Deep space — slightly blue, not pure black
        ctx.fillStyle = '#020410';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const minDim = Math.min(w, h);
        const scale = minDim * 0.46;
        const cosRot = elapsed * 0.00004;

        // ── Central luminous core ──
        const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.5);
        coreG.addColorStop(0, `rgba(255, 220, 150, 0.4)`);
        coreG.addColorStop(0.1, `rgba(255, 190, 110, 0.2)`);
        coreG.addColorStop(0.35, `rgba(200, 130, 65, 0.06)`);
        coreG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreG;
        ctx.fillRect(0, 0, w, h);

        // Gravity-lensing ring
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 210, 130, 0.1)`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // ── Galaxy stars ──
        for (const star of stars) {
            const ra = star.angle + cosRot;
            const sx = cx + Math.cos(ra) * star.dist * scale;
            const sy = cy + Math.sin(ra) * star.dist * star.ySkew * scale;
            const tw = 0.45 + 0.55 * Math.sin(elapsed * 0.002 * star.twSpeed + star.twPhase);
            const br = star.br * tw;

            ctx.beginPath();
            ctx.arc(sx, sy, star.size * (0.7 + br * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${star.hue}, ${star.sat}%, ${40 + br * 35}%, ${br * 0.85})`;
            ctx.fill();

            if (br > 0.5) {
                const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.size * 6);
                sg.addColorStop(0, `hsla(${star.hue}, ${star.sat}%, 72%, ${br * 0.2})`);
                sg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.arc(sx, sy, star.size * 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Filaments (supply chains / capital flows) ──
        ctx.lineWidth = 0.4;
        for (let i = 0; i < stars.length - 1; i += 3) {
            const s1 = stars[i], s2 = stars[i + 1];
            const r1 = s1.angle + cosRot, r2 = s2.angle + cosRot;
            const x1 = cx + Math.cos(r1) * s1.dist * scale;
            const y1 = cy + Math.sin(r1) * s1.dist * s1.ySkew * scale;
            const x2 = cx + Math.cos(r2) * s2.dist * scale;
            const y2 = cy + Math.sin(r2) * s2.dist * s2.ySkew * scale;
            if (Math.hypot(x2 - x1, y2 - y1) < scale * 0.14) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(100, 120, 190, 0.12)`;
                ctx.stroke();
            }
        }

        // ── Candlestick formations ──
        const candleP = smoothstep(0.03, 0.2, t);
        if (candleP > 0) {
            const clampPrice = value => Math.max(0.1, Math.min(0.9, value));
            for (let side = 0; side < 2; side++) {
                const bx = side === 0 ? w * 0.02 : w * 0.86;
                const cS = h * 0.32;
                const columnDrift = Math.sin(elapsed * 0.0005 + side) * w * 0.015;
                for (let i = 0; i < candles.length; i++) {
                    const c = candles[i];
                    const horizontalWave = Math.sin(elapsed * 0.0018 + i * 0.3 + side) * 8 * candleP;
                    const cx_ = bx + columnDrift + (i / candles.length) * w * 0.12 + horizontalWave;
                    const volatility = Math.sin(elapsed * 0.003 + i * 0.22 + side * 0.5) * 0.08 * candleP;
                    const bias = Math.cos(elapsed * 0.001 + i * 0.12) * 0.02;

                    const open = clampPrice(c.open + volatility + bias);
                    const close = clampPrice(c.close + volatility * 0.9 - bias * 0.5);
                    const high = clampPrice(c.high + volatility * 1.15 + bias);
                    const low = clampPrice(c.low + volatility * 1.15 - bias);

                    const bTop = cy - (Math.max(open, close) - 0.35) * cS;
                    const bBot = cy - (Math.min(open, close) - 0.35) * cS;
                    const wTop = cy - (high - 0.35) * cS;
                    const wBot = cy - (low - 0.35) * cS;

                    const cA = candleP * (0.35 + 0.15 * Math.sin(elapsed * 0.004 + i));
                    const col = close >= open
                        ? `rgba(50, 210, 100, ${cA})`
                        : `rgba(210, 50, 80, ${cA})`;
                    const bodyWidth = 3.5 + Math.sin(elapsed * 0.0045 + i) * 1.1;

                    ctx.beginPath();
                    ctx.moveTo(cx_, wTop);
                    ctx.lineTo(cx_, wBot);
                    ctx.strokeStyle = col;
                    ctx.lineWidth = 0.85;
                    ctx.stroke();
                    ctx.fillStyle = col;
                    ctx.fillRect(cx_ - bodyWidth / 2, bTop, bodyWidth, Math.max(1, bBot - bTop));
                }
            }
        }

        // ── Order book columns ──
        const orderP = smoothstep(0.06, 0.25, t);
        if (orderP > 0) {
            for (const col of orderCols) {
                const ox = cx + col.x * scale * 0.5;
                const pulse = 0.35 + 0.65 * Math.abs(Math.sin(elapsed * 0.002 * col.speed + col.phase));
                const oh = col.height * minDim * pulse;
                const oA = orderP * 0.28;
                const oG = ctx.createLinearGradient(ox, cy - oh, ox, cy);
                oG.addColorStop(0, `hsla(${col.hue}, 75%, 68%, ${oA})`);
                oG.addColorStop(1, `hsla(${col.hue}, 75%, 68%, 0)`);
                ctx.fillStyle = oG;
                ctx.fillRect(ox - col.width * minDim * 0.5, cy - oh, col.width * minDim, oh);
            }
        }

        // ── Currency-pair binary stars ──
        const pairP = smoothstep(0.1, 0.3, t);
        if (pairP > 0) {
            const pairs = [
                { x: 0.32, y: -0.22, h1: 200, h2: 45, p: 3600 },
                { x: -0.38, y: 0.18, h1: 150, h2: 305, p: 4600 },
                { x: 0.12, y: 0.38, h1: 28, h2: 185, p: 3000 },
                { x: -0.2, y: -0.35, h1: 60, h2: 240, p: 5200 }
            ];
            for (const pr of pairs) {
                const oa = (elapsed / pr.p) * Math.PI * 2;
                const oR = minDim * 0.025;
                const pcx = cx + pr.x * scale, pcy = cy + pr.y * scale;
                const pA = pairP * 0.75;
                for (let si = 0; si < 2; si++) {
                    const sign = si === 0 ? 1 : -1;
                    ctx.beginPath();
                    ctx.arc(pcx + Math.cos(oa) * oR * sign, pcy + Math.sin(oa) * oR * sign, 3, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${si === 0 ? pr.h1 : pr.h2}, 85%, 65%, ${pA})`;
                    ctx.fill();
                }
                const spG = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, oR * 4);
                spG.addColorStop(0, `rgba(255, 250, 200, ${pA * 0.1 * (0.5 + 0.5 * Math.sin(elapsed * 0.004))})`);
                spG.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = spG;
                ctx.beginPath();
                ctx.arc(pcx, pcy, oR * 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Derivative comets ──
        const cometP = smoothstep(0.15, 0.35, t);
        if (cometP > 0) {
            for (const cm of comets) {
                const ca = cm.phase + elapsed * cm.speed;
                const cr = cm.radius * scale;
                const hx = cx + Math.cos(ca) * cr;
                const hy = cy + Math.sin(ca) * cr * (1 - cm.ecc * 0.45);
                ctx.beginPath();
                ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${cm.hue}, 75%, 70%, ${cometP * 0.65})`;
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                for (let ti = 1; ti <= cm.tail; ti++) {
                    const ta = ca - ti * cm.speed * 60;
                    ctx.lineTo(cx + Math.cos(ta) * cr, cy + Math.sin(ta) * cr * (1 - cm.ecc * 0.45));
                }
                ctx.strokeStyle = `hsla(${cm.hue}, 60%, 60%, ${cometP * 0.15})`;
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        }

        // ── Neural networks ──
        const neuralP = smoothstep(0.08, 0.35, t);
        if (neuralP > 0) {
            for (const e of neural.edges) {
                const n1 = neural.nodes[e.from], n2 = neural.nodes[e.to];
                const nx1 = cx + n1.x * scale * 0.65, ny1 = cy + n1.y * scale * 0.65;
                const nx2 = cx + n2.x * scale * 0.65, ny2 = cy + n2.y * scale * 0.65;
                const pulse = 0.2 + 0.8 * Math.abs(Math.sin(elapsed * 0.002 + e.str * 10));
                ctx.beginPath();
                ctx.moveTo(nx1, ny1);
                ctx.lineTo(nx2, ny2);
                ctx.strokeStyle = `rgba(100, 150, 255, ${neuralP * 0.16 * pulse * e.str})`;
                ctx.lineWidth = 0.5 + e.str * 1.2;
                ctx.stroke();
            }
            for (const nd of neural.nodes) {
                const nx = cx + nd.x * scale * 0.65, ny = cy + nd.y * scale * 0.65;
                const pulse = 0.4 + 0.6 * Math.sin(elapsed * 0.003 * nd.pSpeed + nd.pPhase);
                ctx.beginPath();
                ctx.arc(nx, ny, nd.size * pulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(120, 165, 255, ${neuralP * 0.35 * pulse})`;
                ctx.fill();
                const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nd.size * 4);
                ng.addColorStop(0, `rgba(100, 145, 255, ${neuralP * 0.15 * pulse})`);
                ng.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = ng;
                ctx.beginPath();
                ctx.arc(nx, ny, nd.size * 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Gradient-propagation shockwave
            const shockT = (elapsed % 3000) / 3000;
            if (shockT < 0.3) {
                const sr = shockT / 0.3 * scale * 0.8;
                const sA = (1 - shockT / 0.3) * 0.1 * neuralP;
                ctx.beginPath();
                ctx.arc(cx, cy, sr, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(155, 185, 255, ${sA})`;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
        }

        // ── Gas clouds (training data) ──
        if (t > 0.12 && t < 0.7) {
            const clA = smoothstep(0.12, 0.25, t) * (1 - smoothstep(0.5, 0.7, t)) * 0.08;
            for (let i = 0; i < 7; i++) {
                const clx = cx + Math.cos(i * 1.05 + elapsed * 0.00003) * scale * (0.5 + i * 0.07);
                const cly = cy + Math.sin(i * 1.4 + elapsed * 0.00003) * scale * (0.4 + i * 0.05);
                const clr = minDim * (0.045 + 0.03 * Math.sin(elapsed * 0.0003 + i));
                const cg = ctx.createRadialGradient(clx, cly, 0, clx, cly, clr);
                cg.addColorStop(0, `rgba(150, 100, 210, ${clA})`);
                cg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = cg;
                ctx.beginPath();
                ctx.arc(clx, cly, clr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── HFT flashes ──
        const hftP = smoothstep(0.2, 0.4, t);
        if (hftP > 0) {
            for (let f = 0; f < 8; f++) {
                const fp = ((elapsed * 0.013 + f * 157) % 100) / 100;
                if (fp > 0.07) continue;
                const fA = (1 - fp / 0.07) * hftP * 0.65;
                const fx1 = cx + Math.cos(f * 2 + elapsed * 0.0009) * scale * 0.25;
                const fy1 = cy + Math.sin(f * 2.8 + elapsed * 0.0009) * scale * 0.25;
                const fx2 = cx + Math.cos(f * 2 + elapsed * 0.0009 + 0.65) * scale * 0.55;
                const fy2 = cy + Math.sin(f * 2.8 + elapsed * 0.0009 + 0.65) * scale * 0.55;
                ctx.beginPath();
                ctx.moveTo(fx1, fy1);
                ctx.lineTo(fx2, fy2);
                ctx.strokeStyle = `rgba(255, 255, 195, ${fA})`;
                ctx.lineWidth = 1.8;
                ctx.stroke();
            }
        }

        // ── News-event burst ripples ──
        const burstT = (elapsed % 5000) / 5000;
        if (burstT < 0.1 && t > 0.15) {
            const br = (burstT / 0.1) * scale * 0.6;
            const bA = (1 - burstT / 0.1) * 0.18;
            const bx = cx + Math.cos(elapsed * 0.00007) * scale * 0.2;
            const by = cy + Math.sin(elapsed * 0.00007) * scale * 0.15;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 200, 100, ${bA})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // ── Sentiment indicators ──
        if (t > 0.2) {
            const sA = smoothstep(0.2, 0.4, t) * 0.06;
            for (let i = 0; i < 5; i++) {
                const sp = 0.3 + 0.7 * Math.sin(elapsed * 0.0008 + i * 2.3);
                const sx = cx + Math.cos(i * 1.5 + 0.5) * scale * 0.38;
                const sy = cy + Math.sin(i * 1.5 + 0.5) * scale * 0.32;
                const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, minDim * 0.065);
                sg.addColorStop(0, `rgba(255, 225, 110, ${sA * sp})`);
                sg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.arc(sx, sy, minDim * 0.065, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Probabilistic halos ──
        if (t > 0.3) {
            const hA = smoothstep(0.3, 0.5, t) * 0.1;
            for (let i = 0; i < 4; i++) {
                const hx = cx + Math.cos(i * 1.7 + 0.8) * scale * 0.3;
                const hy = cy + Math.sin(i * 1.7 + 0.8) * scale * 0.24;
                const hr = minDim * 0.06 + Math.sin(elapsed * 0.001 + i) * minDim * 0.018;
                const hg = ctx.createRadialGradient(hx, hy, hr * 0.2, hx, hy, hr);
                hg.addColorStop(0, `rgba(200, 180, 255, ${hA})`);
                hg.addColorStop(0.5, `rgba(150, 130, 225, ${hA * 0.4})`);
                hg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = hg;
                ctx.beginPath();
                ctx.arc(hx, hy, hr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Long-term investment planetary systems ──
        if (t > 0.25) {
            const ltA = smoothstep(0.25, 0.45, t);
            const systems = [
                { x: -0.3, y: 0.32, n: 3, base: 0.04, col: 220 },
                { x: 0.37, y: -0.3, n: 2, base: 0.035, col: 160 }
            ];
            for (const sys of systems) {
                const scx = cx + sys.x * scale, scy = cy + sys.y * scale;
                ctx.beginPath();
                ctx.arc(scx, scy, 4, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${sys.col}, 75%, 72%, ${ltA * 0.7})`;
                ctx.fill();
                for (let p = 0; p < sys.n; p++) {
                    const pa = elapsed * 0.00018 * (1 + p * 0.3) + p * Math.PI * 2 / sys.n;
                    const pr = (sys.base + p * 0.022) * scale;
                    ctx.beginPath();
                    ctx.arc(scx, scy, pr, 0, Math.PI * 2);
                    ctx.strokeStyle = `hsla(${sys.col}, 55%, 55%, ${ltA * 0.12})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(scx + Math.cos(pa) * pr, scy + Math.sin(pa) * pr, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${sys.col + 25}, 65%, 68%, ${ltA * 0.6})`;
                    ctx.fill();
                }
            }
        }

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════
    //  MAIN RENDER LOOP — fluid overlapping phases
    // ══════════════════════════════════════════════════════════════
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

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        const zoom = getZoom(elapsed);

        // Phases with generous overlaps for fluid transitions
        const phases = [
            [drawApproach, 0, 9000],            // 0-9s: Zoom into eyepiece
            [drawOptics, 6000, 18000],          // 6-18s: Inside optics
            [drawDataTransform, 15000, 26000],  // 15-26s: Data transformation
            [drawCosmos, 23000, 32000]          // 23-32s: Financial cosmos
        ];

        for (const [fn, start, end] of phases) {
            if (elapsed >= start && elapsed <= end) {
                const t = (elapsed - start) / (end - start);
                fn(t, elapsed, zoom);
            }
        }

        animFrameId = requestAnimationFrame(render);
    }

    // ══════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════════════════════════════
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
            if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, w, h);
            if (onComplete) onComplete();
        },
        resize: function () {
            if (canvas) { w = canvas.width; h = canvas.height; initParticles(); }
        },
        stop: function () {
            if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        }
    };
})();
