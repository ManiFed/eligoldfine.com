// Landing Page - Animated Lines Canvas
const linesCanvas = document.getElementById('linesCanvas');
const linesCtx = linesCanvas.getContext('2d');
const landing = document.getElementById('landing');
const mainSite = document.getElementById('mainSite');

let linesWidth, linesHeight;
let lines = [];
let animationStartTime;
const ANIMATION_DURATION = 4000; // 4 seconds before transition

function resizeLinesCanvas() {
    linesWidth = window.innerWidth;
    linesHeight = window.innerHeight;
    linesCanvas.width = linesWidth;
    linesCanvas.height = linesHeight;
}

class Line {
    constructor() {
        this.reset();
    }

    reset() {
        // Start from center
        this.x = linesWidth / 2;
        this.y = linesHeight / 2;

        // Random angle from center
        this.angle = Math.random() * Math.PI * 2;

        // Speed varies
        this.speed = 2 + Math.random() * 8;

        // Line length
        this.length = 50 + Math.random() * 200;

        // Color variations - blues, purples, cyans, with some reds and greens
        const colors = [
            `hsla(${200 + Math.random() * 60}, 80%, 60%, `, // Blues/Cyans
            `hsla(${270 + Math.random() * 40}, 70%, 50%, `, // Purples
            `hsla(${180 + Math.random() * 40}, 70%, 50%, `, // Teals
            `hsla(${350 + Math.random() * 20}, 70%, 50%, `, // Reds
            `hsla(${100 + Math.random() * 40}, 60%, 50%, `, // Greens
        ];
        this.colorBase = colors[Math.floor(Math.random() * colors.length)];

        // Opacity
        this.opacity = 0.3 + Math.random() * 0.5;

        // Width
        this.width = 1 + Math.random() * 2;

        // Distance traveled
        this.distance = 0;
        this.maxDistance = Math.max(linesWidth, linesHeight) * 0.8;
    }

    update() {
        // Move outward from center
        this.distance += this.speed;

        // Calculate position based on angle and distance
        const centerX = linesWidth / 2;
        const centerY = linesHeight / 2;

        this.x = centerX + Math.cos(this.angle) * this.distance;
        this.y = centerY + Math.sin(this.angle) * this.distance;

        // Reset if off screen or max distance reached
        if (this.distance > this.maxDistance ||
            this.x < -100 || this.x > linesWidth + 100 ||
            this.y < -100 || this.y > linesHeight + 100) {
            this.reset();
            this.distance = 0;
        }
    }

    draw() {
        // Calculate tail position (toward center)
        const tailX = this.x - Math.cos(this.angle) * this.length;
        const tailY = this.y - Math.sin(this.angle) * this.length;

        // Create gradient for the line
        const gradient = linesCtx.createLinearGradient(tailX, tailY, this.x, this.y);
        gradient.addColorStop(0, this.colorBase + '0)');
        gradient.addColorStop(0.5, this.colorBase + this.opacity + ')');
        gradient.addColorStop(1, this.colorBase + (this.opacity * 0.8) + ')');

        linesCtx.beginPath();
        linesCtx.moveTo(tailX, tailY);
        linesCtx.lineTo(this.x, this.y);
        linesCtx.strokeStyle = gradient;
        linesCtx.lineWidth = this.width;
        linesCtx.lineCap = 'round';
        linesCtx.stroke();
    }
}

function initLines() {
    lines = [];
    // Create many lines
    for (let i = 0; i < 150; i++) {
        const line = new Line();
        // Stagger initial distances
        line.distance = Math.random() * line.maxDistance;
        lines.push(line);
    }
}

function animateLines(timestamp) {
    if (!animationStartTime) animationStartTime = timestamp;
    const elapsed = timestamp - animationStartTime;

    // Clear canvas with slight fade for trail effect
    linesCtx.fillStyle = 'rgba(10, 10, 10, 0.15)';
    linesCtx.fillRect(0, 0, linesWidth, linesHeight);

    // Update and draw all lines
    for (const line of lines) {
        line.update();
        line.draw();
    }

    // Add glow in center
    const gradient = linesCtx.createRadialGradient(
        linesWidth / 2, linesHeight / 2, 0,
        linesWidth / 2, linesHeight / 2, 200
    );
    gradient.addColorStop(0, 'rgba(124, 58, 237, 0.1)');
    gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
    linesCtx.fillStyle = gradient;
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
