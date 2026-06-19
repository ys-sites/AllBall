import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import { translations } from './translations.js';

gsap.registerPlugin(ScrollTrigger);

/* =============================================
   RENDERER + SCENE + CAMERA
   ============================================= */
const canvas = document.getElementById('ball-canvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
});
// Render inside the stats section instead of full window
const statsSection = document.getElementById('stats-section');
const getCanvasSize = () => {
  // On mobile the canvas is a square CSS block; read its actual rendered size
  const w = canvas.clientWidth || statsSection.clientWidth;
  const h = canvas.clientHeight || statsSection.clientHeight;
  return { width: w, height: h };
};

const size = getCanvasSize();
renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.64;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(32, size.width / size.height, 0.1, 200);
camera.position.set(0, 0, 5.5);

/* =============================================
   ENVIRONMENT (REFLECTIONS)
   ============================================= */
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

/* =============================================
   LIGHTING
   ============================================= */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-2, 4, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffa87d, 1.6); // rich street-lamp orange glow
fillLight.position.set(4, 1, -2);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x111122, 0.6);
scene.add(hemiLight);

/* =============================================
   BALL SECTION WAYPOINTS (REMOVED)
   ============================================= */
const isMobile = () => window.innerWidth <= 768;
const BALL_SCALE = isMobile() ? 0.95 : 1.2;

/* =============================================
   STATE
   ============================================= */
let ball = null;
let ballLoaded = false;
let baseScale = 1;
const raycaster = new THREE.Raycaster();

// Mouse hover & position tracking
let targetMouse = { x: 0, y: 0 };
let currentMouse = { x: 0, y: 0 };
let basePos = { x: isMobile() ? 0 : 2.0, y: 0.0, z: 0 };

// Auto-rotation velocities
const BASE_SPEED = 0.003;
let autoVel = {
  x: (Math.random() - 0.5) * 0.003,
  y: BASE_SPEED + Math.random() * 0.002,
};

// Drag state
let isDragging = false;
let isTouchDraggingBall = false; // true only when touch confirmed a hit on the ball mesh
let prevMouse = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
const DAMPING = 0.94;

// Listen to mousemove across the window to track hover direction
window.addEventListener('mousemove', (e) => {
  targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  targetMouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

// Reset target positions on mouseout
window.addEventListener('mouseout', (e) => {
  if (e.relatedTarget === null) {
    targetMouse.x = 0;
    targetMouse.y = 0;
  }
});

/* =============================================
   LOAD GLB
   ============================================= */
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load(
  '/models/basketball.glb',
  (gltf) => {
    ball = gltf.scene;

    // Center the model
    const box = new THREE.Box3().setFromObject(ball);
    ball.position.sub(box.getCenter(new THREE.Vector3()));

    // Normalize scale so ball's longest axis = 2.4 units
    const sizeBox = box.getSize(new THREE.Vector3());
    baseScale = 2.4 / Math.max(sizeBox.x, sizeBox.y, sizeBox.z);
    
    // Position ball on the right side of the container (since it's in stats-left flex grid)
    ball.scale.setScalar(baseScale * BALL_SCALE);
    ball.position.set(basePos.x, basePos.y, basePos.z);

    // Material overrides — premium tactile street look
    ball.traverse((child) => {
      if (child.isMesh && child.material) {
        const m = child.material;
        m.envMapIntensity = 1.8;  // Raised from 0.85 — restores full 3D shading depth
        if (m.roughness !== undefined) m.roughness = 0.44;  // Tactile leather texture
        if (m.metalness !== undefined) m.metalness = 0.12;  // Subtle sheen
        m.needsUpdate = true;
      }
    });

    scene.add(ball);
    ballLoaded = true;
    ballEntrance();
  },
  (progress) => {
    if (progress.lengthComputable) {
      // Loading progress (silent)
    }
  },
  (error) => {
    console.warn('GLB load error:', error);
  }
);

/* =============================================
   ENTRANCE ANIMATION (simplified)
   ============================================= */
function ballEntrance() {
  if (!ball) return;
  
  // Just pop in
  ball.scale.setScalar(0.01);
  gsap.to(ball.scale, {
    x: baseScale * BALL_SCALE, y: baseScale * BALL_SCALE, z: baseScale * BALL_SCALE,
    duration: 1.3,
    ease: 'expo.out',
    delay: 0.2,
    onComplete: () => {
      setupScrollBall();
    }
  });
  enableDrag();
}

/* =============================================
   DRAG PHYSICS
   ============================================= */
function enableDrag() {
  canvas.classList.add('drag-enabled');
}

function disableDrag() {
  canvas.classList.remove('drag-enabled');
}

function getEventPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('mousedown', onDragStart);
canvas.addEventListener('touchstart', onDragStart, { passive: false });

function onDragStart(e) {
  const isTouchEvent = e.touches && e.touches.length > 0;

  if (isTouchEvent) {
    // Always run the hit-test on touch — bail before setting isDragging if miss
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    const ndcVector = new THREE.Vector2(x, y);

    raycaster.setFromCamera(ndcVector, camera);
    const intersects = raycaster.intersectObjects(ball ? [ball] : [], true);

    if (intersects.length === 0) {
      // Touch missed the ball — let the page scroll normally
      return;
    }

    // Touch confirmed on the ball mesh
    isTouchDraggingBall = true;
    if (e.cancelable) {
      e.preventDefault();
    }
  }

  isDragging = true;
  const pos = getEventPos(e);
  prevMouse.x = pos.x;
  prevMouse.y = pos.y;
  velocity.x = 0;
  velocity.y = 0;
}

window.addEventListener('mousemove', onDragMove);
window.addEventListener('touchmove', onDragMove, { passive: false }); // Disable passive to allow preventDefault

function onDragMove(e) {
  if (!isDragging || !ball) return;
  // Only block page scroll when the touch was confirmed to hit the ball
  if (isTouchDraggingBall && e.cancelable) {
    e.preventDefault();
  }
  const pos = getEventPos(e);
  velocity.x = (pos.y - prevMouse.y) * 0.006;
  velocity.y = (pos.x - prevMouse.x) * 0.006;
  ball.rotation.x += velocity.x;
  ball.rotation.y += velocity.y;
  prevMouse.x = pos.x;
  prevMouse.y = pos.y;
}

window.addEventListener('mouseup', onDragEnd);
window.addEventListener('touchend', onDragEnd);

function onDragEnd() {
  if (!isDragging) return;
  isDragging = false;
  isTouchDraggingBall = false; // Reset touch-ball flag
  // Transfer momentum to autoVel
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  if (speed > 0.0005) {
    autoVel.x = velocity.x * 0.5;
    autoVel.y = velocity.y * 0.5;
  }
}

/* =============================================
   SCROLL-DRIVEN BALL POSITIONING
   ============================================= */
function setupScrollBall() {
  // Static now. Scroll-driven updates are calculated in the animation loop.
}

/* =============================================
   SCROLL-TRIGGERED SECTION ANIMATIONS
   ============================================= */
ScrollTrigger.create({
  trigger: '#stats-section',
  start: 'top 75%',
  onEnter: () => {
    gsap.to('.stat-card', {
      opacity: 1,
      y: 0,
      stagger: 0.1,
      duration: 0.8,
      ease: 'expo.out',
      delay: 0.1,
    });
  },
});

ScrollTrigger.create({
  trigger: '#how-section',
  start: 'top 70%',
  onEnter: () => {
    gsap.to('.step-item', {
      opacity: 1,
      x: 0,
      stagger: 0.15,
      duration: 0.9,
      ease: 'expo.out',
      delay: 0.1,
    });
  },
});

/* =============================================
   NAVBAR SCROLL BEHAVIOR
   ============================================= */
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 80) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

/* =============================================
   GSAP UI ENTRANCE SEQUENCE
   ============================================= */
// Set initial states
gsap.set('.nav-links-wrapper', { opacity: 0, y: -8 });
gsap.set('.lang-selector', { opacity: 0, y: -8 });
gsap.set('.nav-cta-btn', { opacity: 0, y: -8 });

const tl = gsap.timeline({ delay: 0.15 });

tl.to('.nav-links-wrapper', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.15)
  .to('.lang-selector', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.2)
  .to('.nav-cta-btn', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'transform' }, 0.25)
  .to('.hero-cards-wrapper', { opacity: 1, x: 0, duration: 1.1, ease: 'expo.out' }, 0.45)
  .to('#hero-text', { opacity: 1, x: 0, duration: 1.1, ease: 'expo.out' }, 0.55)
  .to('#nav-arrow', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 1.0)
  .to('#sig-wrap', { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 1.1)
  .to('.sp1', { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, 1.1)
  .to('.sp2', { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' }, 1.7)
  .to('.sp3', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 1.9);

/* =============================================
   DYNAMIC NAV LINK HIGHLIGHTING ON SCROLL
   ============================================= */
const navLinks = document.querySelectorAll('.nav-links a');
const sectionMappings = [
  { id: '#how-section', linkHref: '#how-section' },
  { id: '#services-section', linkHref: '#services-section' },
  { id: '#birthday-section', linkHref: '#services-section' },
  { id: '#kids-section', linkHref: '#kids-section' },
  { id: '#contact-section', linkHref: '#location-section' },
  { id: '#location-section', linkHref: '#location-section' },
  { id: '#faq-section', linkHref: '#faq-section' },
  { id: '#site-footer', linkHref: '#faq-section' },
];

sectionMappings.forEach((map) => {
  const el = document.querySelector(map.id);
  if (el) {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (self.isActive) {
          navLinks.forEach((link) => {
            if (link.getAttribute('href') === map.linkHref) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      }
    });
  }
});


/* =============================================
   EVENT CARD HOVER (GSAP)
   ============================================= */
document.querySelectorAll('.event-card').forEach((card) => {
  card.addEventListener('mouseenter', () => {
    gsap.to(card, { scale: 1.035, y: -6, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
  });
  card.addEventListener('mouseleave', () => {
    gsap.to(card, { scale: 1.0, y: 0, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
  });
});

/* =============================================
   RENDER LOOP with Throttling (IntersectionObserver)
   ============================================= */
let animationFrameId = null;
let isIntersecting = false;

function animate() {
  if (!isIntersecting) {
    animationFrameId = null;
    return;
  }
  animationFrameId = requestAnimationFrame(animate);

  if (ball) {
    if (!isDragging) {
      // Smoothly interpolate currentMouse towards targetMouse
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.08;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.08;

      // Calculate scroll progress directly
      const maxScroll = ScrollTrigger.maxScroll(window);
      const scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      const baseScrollRotY = scrollProgress * Math.PI * 4.0;
      const baseScrollRotX = scrollProgress * Math.PI * 1.2;

      // Target rotation combines base scroll rotation + mouse hover tilt
      const targetRotY = baseScrollRotY + currentMouse.x * 0.8;
      const targetRotX = baseScrollRotX + currentMouse.y * 0.8;

      // Apply momentum damping if any velocity remains from drag
      if (Math.abs(velocity.x) > 0.0001 || Math.abs(velocity.y) > 0.0001) {
        velocity.x *= DAMPING;
        velocity.y *= DAMPING;
        autoVel.x = velocity.x * 0.5;
        autoVel.y = velocity.y * 0.5;
      }

      ball.rotation.x += (targetRotX - ball.rotation.x) * 0.08 + autoVel.x;
      ball.rotation.y += (targetRotY - ball.rotation.y) * 0.08 + autoVel.y;
      
      // Decay velocity momentum over time
      autoVel.x *= 0.95;
      autoVel.y *= 0.95;

      // Target position incorporates base position + mouse hover parallax shift
      const targetPosX = basePos.x + currentMouse.x * 0.35;
      const targetPosY = basePos.y - currentMouse.y * 0.35;

      ball.position.x += (targetPosX - ball.position.x) * 0.08;
      ball.position.y += (targetPosY - ball.position.y) * 0.08;
    } else {
      // Reset target and current coordinates while dragging to avoid snaps
      targetMouse.x = 0;
      targetMouse.y = 0;
      currentMouse.x = 0;
      currentMouse.y = 0;
    }
  }

  renderer.render(scene, camera);
}

// Observe #stats-section to toggle isIntersecting and start/stop render loop
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    isIntersecting = entry.isIntersecting;
    if (isIntersecting && !animationFrameId) {
      animate();
    }
  });
}, {
  root: null, // relative to document viewport
  rootMargin: '120px', // start rendering early for smooth transition
  threshold: 0,
});

if (statsSection) {
  observer.observe(statsSection);
}

/* =============================================
   GSAP SCROLL-TRIGGERED BLUR REVEALS
   ============================================= */
document.querySelectorAll('.reveal-blur').forEach((el) => {
  gsap.set(el, { filter: 'blur(12px)', opacity: 0, y: 30 });
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    onEnter: () => {
      gsap.to(el, {
        filter: 'blur(0px)',
        opacity: 1,
        y: 0,
        duration: 1.0,
        ease: 'power3.out',
        overwrite: 'auto'
      });
    }
  });
});

/* =============================================
   WINDOW RESIZE
   ============================================= */
window.addEventListener('resize', () => {
  const newSize = getCanvasSize();
  camera.aspect = newSize.width / newSize.height;
  camera.updateProjectionMatrix();
  renderer.setSize(newSize.width, newSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  basePos.x = isMobile() ? 0 : 2.0;
  basePos.y = 0.0;
  if (ball) {
    ball.position.set(basePos.x, basePos.y, basePos.z);
    const currentBallScale = isMobile() ? 0.95 : 1.2;
    ball.scale.setScalar(baseScale * currentBallScale);
  }
  
  if (!isIntersecting) {
    renderer.render(scene, camera);
  }
  
  ScrollTrigger.refresh();
});

/* =============================================
   ON LOAD — SETUP SCROLL
   ============================================= */
window.addEventListener('load', () => {
  setupScrollBall();
  ScrollTrigger.refresh();
});

/* =============================================
   NAV ARROW CLICK
   ============================================= */
const navArrow = document.getElementById('nav-arrow');
if (navArrow) {
  navArrow.addEventListener('click', () => {
    document.getElementById('stats-section')?.scrollIntoView({ behavior: 'smooth' });
  });
}

/* =============================================
   BILINGUAL ENGINE (EN / FR)
   ============================================= */
function switchLanguage(lang) {
  const dict = translations[lang];
  if (!dict) return;

  // Update all [data-i18n] elements
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) {
      el.innerHTML = dict[key];
    }
  });

  // Update [placeholder] attributes  
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key] !== undefined) {
      el.placeholder = dict[key];
    }
  });

  // Update <html lang> attribute
  document.documentElement.lang = lang;

  // Persist preference
  localStorage.setItem('preferredLang', lang);

  // Toggle active state on lang buttons
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Bind lang button clicks
document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    switchLanguage(lang);
  });
});

// Load persisted language on page start (after a tiny delay so GSAP entrance completes)
const savedLang = localStorage.getItem('preferredLang') || 'en';
if (savedLang !== 'en') {
  // Apply saved non-English language after entrance animation
  setTimeout(() => switchLanguage(savedLang), 500);
}

/* =============================================
   HERO VIDEO AUTOPLAY FALLBACK FOR MOBILE
   ============================================= */
function setupHeroVideoAutoplay() {
  const video = document.querySelector('#hero-section video');
  if (!video) return;

  // Force playsinline and muted properties via JS
  video.muted = true;
  video.playsInline = true;

  // Attempt playback
  const playPromise = video.play();
  
  if (playPromise !== undefined) {
    playPromise.catch((error) => {
      console.warn("Autoplay prevented on mobile, waiting for interaction:", error);
      
      const startVideoOnInteraction = () => {
        video.play().then(() => {
          document.removeEventListener('touchstart', startVideoOnInteraction);
          document.removeEventListener('click', startVideoOnInteraction);
          document.removeEventListener('scroll', startVideoOnInteraction);
        }).catch((err) => {
          console.error("Playback fallback failed:", err);
        });
      };

      document.addEventListener('touchstart', startVideoOnInteraction, { passive: true });
      document.addEventListener('click', startVideoOnInteraction, { passive: true });
      document.addEventListener('scroll', startVideoOnInteraction, { passive: true });
    });
  }
}

// Initial trigger
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setupHeroVideoAutoplay();
} else {
  window.addEventListener('DOMContentLoaded', setupHeroVideoAutoplay);
}
