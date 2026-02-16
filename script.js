// Landing Page - Orbit Animation Canvas
const linesCanvas = document.getElementById('linesCanvas');
const linesCtx = linesCanvas.getContext('2d');
const landing = document.getElementById('landing');
const mainSite = document.getElementById('mainSite');
const skipHint = document.getElementById('skipHint');

let linesWidth, linesHeight;
const INTRO_DURATION = 5500;
let introStartTime = null;
let lastIntroTimestamp = null;
let introNodes = [];
let introSparks = [];
let introRings = [];

let landingSequenceFinished = false;
let skipRequested = false;
let observatoryStarted = false;
let skipHandlersAttached = false;
let dotsAnimationRunning = false;

function resizeLinesCanvas() {
    linesWidth = window.innerWidth;
    linesHeight = window.innerHeight;
    linesCanvas.width = linesWidth;
    linesCanvas.height = linesHeight;
}

function attachSkipListeners() {
    if (skipHandlersAttached || !landing) return;
    landing.addEventListener('click', skipIntro);
    landing.addEventListener('touchstart', skipIntro, { passive: true });
    window.addEventListener('keydown', skipIntro);
    skipHandlersAttached = true;
}

function removeSkipListeners() {
    if (!skipHandlersAttached || !landing) return;
    landing.removeEventListener('click', skipIntro);
    landing.removeEventListener('touchstart', skipIntro);
    window.removeEventListener('keydown', skipIntro);
    skipHandlersAttached = false;
}

function revealMainSite() {
    if (landingSequenceFinished) return;
    landingSequenceFinished = true;
    skipRequested = true;
    if (skipHint) skipHint.classList.remove('visible');
    removeSkipListeners();

    landing?.classList.add('hidden');
    mainSite?.classList.add('visible');

    setTimeout(() => {
        if (landing) landing.style.display = 'none';
    }, 1000);

    ensureDotsAnimation();
}

function ensureDotsAnimation() {
    if (dotsAnimationRunning) return;
    dotsAnimationRunning = true;
    initDots();
    requestAnimationFrame(animateDots);
}

function skipIntro(event) {
    if (landingSequenceFinished) return;
    if (event?.type === 'keydown' && event.key === 'Tab') return;
    skipRequested = true;
    if (observatoryStarted && typeof ObservatoryAnimation !== 'undefined') {
        ObservatoryAnimation.skip();
    } else {
        revealMainSite();
    }
}

function startObservatorySequence() {
    if (landingSequenceFinished || observatoryStarted) return;
    observatoryStarted = true;

    attachSkipListeners();
    if (skipHint) skipHint.classList.add('visible');

    if (skipRequested || typeof ObservatoryAnimation === 'undefined') {
        revealMainSite();
        return;
    }

    resizeLinesCanvas();
    ObservatoryAnimation.start(linesCanvas, () => {
        if (!landingSequenceFinished) {
            revealMainSite();
        }
    });
}

class OrbitNode {
    constructor() {
        this.reset();
    }

    reset() {
        const minDim = Math.min(linesWidth, linesHeight);
        this.radius = (0.12 + Math.random() * 0.45) * minDim * 0.5;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = (0.00008 + Math.random() * 0.00035) * (Math.random() > 0.5 ? 1 : -1);
        this.depth = Math.random();
        this.size = 1.2 + Math.random() * 3.5;
        this.orbitTilt = 0.6 + Math.random() * 0.9;
        this.hue = 200 + Math.random() * 100;
        this.trail = [];
    }

    update(delta) {
        this.angle += this.speed * delta;
        const centerX = linesWidth / 2;
        const centerY = linesHeight / 2;
        this.x = centerX + Math.cos(this.angle) * this.radius;
        this.y = centerY + Math.sin(this.angle) * this.radius * this.orbitTilt;

        this.trail.unshift({ x: this.x, y: this.y, life: 1 });
        if (this.trail.length > 35) {
            this.trail.pop();
        }
    }

    draw(progress) {
        const glow = 0.35 + progress * 0.45 + this.depth * 0.2;
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            point.life -= 0.02;
            if (point.life <= 0) continue;
            linesCtx.beginPath();
            linesCtx.arc(point.x, point.y, Math.max(0.5, this.size * point.life * 0.5), 0, Math.PI * 2);
            linesCtx.fillStyle = `hsla(${this.hue}, 70%, ${55 + this.depth * 20}%, ${point.life * glow * 0.45})`;
            linesCtx.fill();
        }

        linesCtx.beginPath();
        linesCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        linesCtx.fillStyle = `hsla(${this.hue}, 80%, ${65 + this.depth * 20}%, ${glow})`;
        linesCtx.fill();

        const halo = linesCtx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 5);
        halo.addColorStop(0, `hsla(${this.hue}, 70%, 70%, ${glow * 0.35})`);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        linesCtx.fillStyle = halo;
        linesCtx.beginPath();
        linesCtx.arc(this.x, this.y, this.size * 5, 0, Math.PI * 2);
        linesCtx.fill();
    }
}

class Spark {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * linesWidth;
        this.y = Math.random() * linesHeight;
        this.speed = 0.02 + Math.random() * 0.08;
        this.size = 0.5 + Math.random() * 1.5;
        this.life = 800 + Math.random() * 1200;
        this.elapsed = Math.random() * this.life;
        this.hue = 260 + Math.random() * 80;
    }

    update(delta) {
        this.elapsed += delta;
        this.y -= this.speed * delta;
        if (this.y < -10 || this.elapsed > this.life) {
            this.reset();
            this.y = linesHeight + Math.random() * 20;
        }
    }

    draw(progress) {
        const alpha = Math.sin((this.elapsed / this.life) * Math.PI) * 0.4 * (0.5 + progress * 0.5);
        linesCtx.beginPath();
        linesCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        linesCtx.fillStyle = `hsla(${this.hue}, 70%, 80%, ${alpha})`;
        linesCtx.fill();
    }
}

class HaloRing {
    constructor(delay) {
        this.delay = delay;
        this.duration = 2200 + Math.random() * 1600;
    }

    draw(time) {
        const localTime = (time - this.delay) % this.duration;
        if (localTime < 0) return;
        const t = localTime / this.duration;
        const radius = Math.min(linesWidth, linesHeight) * 0.12 * (0.5 + t * 2);
        const alpha = (1 - t) * 0.25;
        const centerX = linesWidth / 2;
        const centerY = linesHeight / 2;
        linesCtx.beginPath();
        linesCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        linesCtx.strokeStyle = `rgba(130, 160, 255, ${alpha})`;
        linesCtx.lineWidth = 1.5;
        linesCtx.stroke();
    }
}

function initIntroElements() {
    const nodeCount = Math.floor(Math.min(linesWidth, linesHeight) / 18);
    introNodes = Array.from({ length: nodeCount }, () => new OrbitNode());
    introSparks = Array.from({ length: 80 }, () => new Spark());
    introRings = [new HaloRing(0), new HaloRing(400), new HaloRing(900)];
}

function initLines() {
    introStartTime = null;
    lastIntroTimestamp = null;
    initIntroElements();
}

function drawBackground(progress) {
    const centerX = linesWidth / 2;
    const centerY = linesHeight / 2;
    const gradient = linesCtx.createRadialGradient(
        centerX,
        centerY,
        Math.min(linesWidth, linesHeight) * 0.05,
        centerX,
        centerY,
        Math.max(linesWidth, linesHeight)
    );
    gradient.addColorStop(0, '#090b1a');
    gradient.addColorStop(0.4, '#070716');
    gradient.addColorStop(1, '#05040c');
    linesCtx.fillStyle = gradient;
    linesCtx.fillRect(0, 0, linesWidth, linesHeight);

    const nebula = linesCtx.createRadialGradient(
        centerX - linesWidth * 0.15,
        centerY - linesHeight * 0.2,
        0,
        centerX,
        centerY,
        Math.min(linesWidth, linesHeight) * (0.7 + progress * 0.3)
    );
    nebula.addColorStop(0, `rgba(120, 90, 255, ${0.15 + progress * 0.1})`);
    nebula.addColorStop(0.3, `rgba(70, 130, 255, ${0.08 + progress * 0.05})`);
    nebula.addColorStop(0.7, 'rgba(0,0,0,0)');
    linesCtx.fillStyle = nebula;
    linesCtx.fillRect(0, 0, linesWidth, linesHeight);
}

function drawConstellations(progress) {
    const threshold = 80 + progress * 220;
    for (let i = 0; i < introNodes.length; i++) {
        for (let j = i + 1; j < introNodes.length; j++) {
            const n1 = introNodes[i];
            const n2 = introNodes[j];
            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > threshold) continue;
            const alpha = (1 - dist / threshold) * (0.15 + progress * 0.25);
            linesCtx.strokeStyle = `rgba(150, 170, 255, ${alpha})`;
            linesCtx.lineWidth = 0.5 + (1 - dist / threshold) * 0.6;
            linesCtx.beginPath();
            linesCtx.moveTo(n1.x, n1.y);
            linesCtx.lineTo(n2.x, n2.y);
            linesCtx.stroke();
        }
    }
}

function animateLines(timestamp) {
    if (!introStartTime) introStartTime = timestamp;
    if (!lastIntroTimestamp) lastIntroTimestamp = timestamp;
    const delta = timestamp - lastIntroTimestamp;
    lastIntroTimestamp = timestamp;
    const progress = Math.min((timestamp - introStartTime) / INTRO_DURATION, 1);

    drawBackground(progress);

    introNodes.forEach(node => node.update(delta));
    introSparks.forEach(spark => spark.update(delta));

    drawConstellations(progress);
    introRings.forEach(ring => ring.draw(timestamp));
    introSparks.forEach(spark => spark.draw(progress));
    introNodes.forEach(node => node.draw(progress));

    const centerX = linesWidth / 2;
    const centerY = linesHeight / 2;
    const pulseRadius = Math.min(linesWidth, linesHeight) * (0.08 + progress * 0.1);
    linesCtx.beginPath();
    linesCtx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    linesCtx.strokeStyle = `rgba(255, 255, 255, ${0.12 + progress * 0.2})`;
    linesCtx.lineWidth = 0.8;
    linesCtx.stroke();

    if (progress < 1) {
        requestAnimationFrame(animateLines);
    } else {
        startObservatorySequence();
    }
}
// Main Site - Floating Dots Canvas
const dotsCanvas = document.getElementById('dotsCanvas');
const dotsCtx = dotsCanvas.getContext('2d');
let dotsWidth, dotsHeight;
let dots = [];

function resizeDotsCanvas() {
    dotsWidth = window.innerWidth;
    dotsHeight = window.innerHeight;
    dotsCanvas.width = dotsWidth;
    dotsCanvas.height = dotsHeight;
}

class Dot {
    constructor() {
        this.x = Math.random() * dotsWidth;
        this.y = Math.random() * dotsHeight;
        this.baseSize = 1 + Math.random() * 2;
        this.size = this.baseSize;

        // Movement
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;

        // Brightness animation
        this.baseBrightness = 0.2 + Math.random() * 0.3;
        this.brightness = this.baseBrightness;
        this.brightnessSpeed = 0.005 + Math.random() * 0.02;
        this.brightnessPhase = Math.random() * Math.PI * 2;

        // Color (subtle purples/blues)
        this.hue = 240 + Math.random() * 60;
    }

    update(time) {
        // Move
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around screen
        if (this.x < 0) this.x = dotsWidth;
        if (this.x > dotsWidth) this.x = 0;
        if (this.y < 0) this.y = dotsHeight;
        if (this.y > dotsHeight) this.y = 0;

        // Animate brightness
        this.brightness = this.baseBrightness +
            Math.sin(time * this.brightnessSpeed + this.brightnessPhase) * 0.3;
        this.brightness = Math.max(0.05, Math.min(0.8, this.brightness));

        // Size pulses slightly with brightness
        this.size = this.baseSize * (0.8 + this.brightness * 0.4);
    }

    draw() {
        dotsCtx.beginPath();
        dotsCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        dotsCtx.fillStyle = `hsla(${this.hue}, 60%, 70%, ${this.brightness})`;
        dotsCtx.fill();

        // Add glow for brighter dots
        if (this.brightness > 0.4) {
            dotsCtx.beginPath();
            dotsCtx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
            dotsCtx.fillStyle = `hsla(${this.hue}, 60%, 70%, ${this.brightness * 0.2})`;
            dotsCtx.fill();
        }
    }
}

function initDots() {
    dots = [];
    const numDots = Math.floor((dotsWidth * dotsHeight) / 8000); // Density based on screen size
    for (let i = 0; i < numDots; i++) {
        dots.push(new Dot());
    }
}

let dotsAnimationTime = 0;

function animateDots() {
    dotsCtx.clearRect(0, 0, dotsWidth, dotsHeight);

    dotsAnimationTime++;

    for (const dot of dots) {
        dot.update(dotsAnimationTime);
        dot.draw();
    }

    requestAnimationFrame(animateDots);
}

function setupNameReveal() {
    const nameEl = document.querySelector('.name');
    if (!nameEl || nameEl.dataset.enhanced === 'true') return;

    const textContent = nameEl.textContent.trim();
    const fragment = document.createDocumentFragment();
    nameEl.textContent = '';

    [...textContent].forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.style.animationDelay = `${index * 0.05}s`;
        fragment.appendChild(span);
    });

    nameEl.appendChild(fragment);
    nameEl.dataset.enhanced = 'true';
}

// Initialize
function init() {
    setupNameReveal();
    resizeLinesCanvas();
    resizeDotsCanvas();
    initLines();
    attachSkipListeners();

    setTimeout(() => {
        if (!landingSequenceFinished && skipHint) {
            skipHint.classList.add('visible');
        }
    }, 1500);

    // Start lines animation
    requestAnimationFrame(animateLines);
}

// Handle resize
window.addEventListener('resize', () => {
    resizeLinesCanvas();
    resizeDotsCanvas();

    if (!mainSite.classList.contains('visible')) {
        initLines();
    }

    // Reinitialize dots if on main site
    if (mainSite.classList.contains('visible')) {
        initDots();
    }

    // Resize observatory animation if running
    if (typeof ObservatoryAnimation !== 'undefined') {
        ObservatoryAnimation.resize();
    }
});

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Start
init();
