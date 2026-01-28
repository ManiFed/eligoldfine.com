// Landing Page - Animated Lines Canvas
const linesCanvas = document.getElementById('linesCanvas');
const linesCtx = linesCanvas.getContext('2d');
const landing = document.getElementById('landing');
const mainSite = document.getElementById('mainSite');

let linesWidth, linesHeight;
let lines = [];
let animationStartTime;
let globalTime = 0;
const ANIMATION_DURATION = 3000; // 3 seconds before transition

function resizeLinesCanvas() {
    linesWidth = window.innerWidth;
    linesHeight = window.innerHeight;
    linesCanvas.width = linesWidth;
    linesCanvas.height = linesHeight;
}

class CurvedLine {
    constructor(index, total) {
        const centerY = linesHeight / 2;

        // Cluster lines around the center vertically with gaussian-like distribution
        const spread = 0.35; // How spread out the lines are (0-1, lower = more clustered)
        const gaussianRandom = () => {
            let u = 0, v = 0;
            while (u === 0) u = Math.random();
            while (v === 0) v = Math.random();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        };

        // Distribute lines with clustering toward center
        this.baseY = centerY + gaussianRandom() * linesHeight * spread;

        // Offset for wave animation
        this.phaseOffset = Math.random() * Math.PI * 2;

        // Speed of horizontal movement (very slow)
        this.speed = 0.15 + Math.random() * 0.25;

        // Direction: some lines go left, some go right
        this.direction = Math.random() > 0.5 ? 1 : -1;

        // Horizontal offset that changes over time
        this.xOffset = Math.random() * linesWidth;

        // Curvature amount - how much the line bends spherically
        this.curvature = 0.08 + Math.random() * 0.12;

        // Vertical wave amplitude
        this.waveAmplitude = 3 + Math.random() * 6;

        // Color - start with a random hue, will shift over time
        this.baseHue = Math.random() * 360;
        this.hueSpeed = 15 + Math.random() * 25; // How fast the color shifts
        this.saturation = 60 + Math.random() * 30;
        this.lightness = 50 + Math.random() * 20;

        // Medium opacity - between subtle and intense
        this.baseOpacity = 0.15 + Math.random() * 0.2;

        // Line thickness
        this.width = 0.5 + Math.random() * 1.5;
    }

    draw(time) {
        const centerX = linesWidth / 2;
        const centerY = linesHeight / 2;

        // Slowly move the line horizontally
        this.xOffset += this.speed * this.direction;

        // Wrap around
        if (this.xOffset > linesWidth + 200) this.xOffset = -200;
        if (this.xOffset < -200) this.xOffset = linesWidth + 200;

        linesCtx.beginPath();

        // Draw a curved horizontal line with spherical distortion
        const segments = 120;
        const lineLength = linesWidth * 1.8;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;

            // Base x position across the line
            const baseX = (t - 0.5) * lineLength + this.xOffset;

            // Calculate distance from center for spherical curve
            const dx = baseX - centerX;
            const normalizedDx = dx / (linesWidth * 0.5);

            // Spherical curvature - lines bend away from center creating globe effect
            const sphereFactor = Math.max(0, 1 - normalizedDx * normalizedDx);
            const sphericalOffset = Math.sqrt(sphereFactor) * this.curvature * linesHeight;

            // Gentle wave motion
            const wave = Math.sin(time * 0.0004 + this.phaseOffset + t * Math.PI * 3) * this.waveAmplitude;

            // Determine if line is above or below center
            const aboveCenter = this.baseY < centerY;

            // Final y position - curve away from center
            const y = this.baseY + sphericalOffset * (aboveCenter ? -1 : 1) * 0.4 + wave;

            // Fade out at horizontal edges
            const edgeFade = Math.pow(sphereFactor, 0.5);

            if (i === 0) {
                linesCtx.moveTo(baseX, y);
            } else {
                linesCtx.lineTo(baseX, y);
            }
        }

        // Calculate opacity with subtle pulsing
        const pulse = Math.sin(time * 0.0008 + this.phaseOffset) * 0.03;
        const opacity = Math.max(0.05, this.baseOpacity + pulse);

        // Color shifts over time
        const currentHue = (this.baseHue + time * 0.01 * this.hueSpeed / 100) % 360;

        linesCtx.strokeStyle = `hsla(${currentHue}, ${this.saturation}%, ${this.lightness}%, ${opacity})`;
        linesCtx.lineWidth = this.width;
        linesCtx.lineCap = 'round';
        linesCtx.stroke();
    }
}

function initLines() {
    lines = [];
    // Create horizontal curved lines clustered around center
    const numLines = 80;
    for (let i = 0; i < numLines; i++) {
        lines.push(new CurvedLine(i, numLines));
    }
}

function animateLines(timestamp) {
    if (!animationStartTime) animationStartTime = timestamp;
    const elapsed = timestamp - animationStartTime;
    globalTime = timestamp;

    // Clear canvas completely for clean lines
    linesCtx.fillStyle = 'rgba(10, 10, 10, 1)';
    linesCtx.fillRect(0, 0, linesWidth, linesHeight);

    // Draw all curved lines
    for (const line of lines) {
        line.draw(globalTime);
    }

    // Add glowing aura around the center cluster
    const centerX = linesWidth / 2;
    const centerY = linesHeight / 2;
    const glowRadius = Math.min(linesWidth, linesHeight) * 0.5;

    // Outer soft glow
    const outerGlow = linesCtx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, glowRadius * 1.2
    );
    outerGlow.addColorStop(0, 'rgba(100, 120, 255, 0.08)');
    outerGlow.addColorStop(0.3, 'rgba(130, 80, 200, 0.05)');
    outerGlow.addColorStop(0.6, 'rgba(80, 100, 180, 0.02)');
    outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    linesCtx.fillStyle = outerGlow;
    linesCtx.fillRect(0, 0, linesWidth, linesHeight);

    // Inner brighter glow
    const innerGlow = linesCtx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, glowRadius * 0.6
    );
    innerGlow.addColorStop(0, 'rgba(150, 140, 255, 0.06)');
    innerGlow.addColorStop(0.5, 'rgba(120, 100, 200, 0.03)');
    innerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    linesCtx.fillStyle = innerGlow;
    linesCtx.fillRect(0, 0, linesWidth, linesHeight);

    // Continue animation until duration is reached
    if (elapsed < ANIMATION_DURATION) {
        requestAnimationFrame(animateLines);
    } else {
        // Transition to main site
        transitionToMainSite();
    }
}

function transitionToMainSite() {
    landing.classList.add('hidden');
    mainSite.classList.add('visible');

    // Start dots animation after transition
    setTimeout(() => {
        initDots();
        animateDots();
    }, 500);
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

// Initialize
function init() {
    resizeLinesCanvas();
    resizeDotsCanvas();
    initLines();

    // Start lines animation
    requestAnimationFrame(animateLines);
}

// Handle resize
window.addEventListener('resize', () => {
    resizeLinesCanvas();
    resizeDotsCanvas();

    // Reinitialize dots if on main site
    if (mainSite.classList.contains('visible')) {
        initDots();
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
