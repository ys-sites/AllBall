import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';

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
   return { width: statsSection.clientWidth, height: statsSection.clientHeight };
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
const BALL_SCALE = 1.2;

/* =============================================
   STATE
   ============================================= */
let ball = null;
let ballLoaded = false;
let baseScale = 1;

// Mouse hover & position tracking
let targetMouse = { x: 0, y: 0 };
let currentMouse = { x: 0, y: 0 };
let basePos = { x: window.innerWidth <= 768 ? 0 : 2.0, y: window.innerWidth <= 768 ? 0.5 : 0.0, z: 0 };

// Auto-rotation velocities
const BASE_SPEED = 0.003;
let autoVel = {
  x: (Math.random() - 0.5) * 0.003,
  y: BASE_SPEED + Math.random() * 0.002,
};

// Drag state
let isDragging = false;
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
        m.envMapIntensity = 0.85; // Enhance reflections
        if (m.roughness !== undefined) m.roughness = 0.48; // Tactile leather texture
        if (m.metalness !== undefined) m.metalness = 0.08; // Subtle sheen
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
canvas.addEventListener('touchstart', onDragStart, { passive: true });

function onDragStart(e) {
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
  if (e.cancelable) {
    e.preventDefault(); // Prevent page scroll on touch-dragging the ball
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
// Set initial states for nav-links
gsap.set('.nav-links', { opacity: 0, y: -8 });

const tl = gsap.timeline({ delay: 0.15 });

tl.to('.nav-logo', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.1)
  .to('.nav-links', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.15)
  .to('.profile-btn', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.2)
  .to('#ph-badge', { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.4)
  .to('#event-card', { opacity: 1, x: 0, duration: 1.1, ease: 'expo.out' }, 0.55)
  .to('#hero-text', { opacity: 1, x: 0, duration: 1.1, ease: 'expo.out' }, 0.65)
  .to('#nav-arrow', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 1.1)
  .to('#sig-wrap', { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 1.2)
  .to('.sp1', { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, 1.2)
  .to('.sp2', { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' }, 1.8)
  .to('.sp3', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 2.0);


/* =============================================
   EVENT CARD HOVER (GSAP)
   ============================================= */
const eventCardEl = document.getElementById('event-card');
if (eventCardEl) {
  eventCardEl.addEventListener('mouseenter', () => {
    gsap.to(eventCardEl, { scale: 1.035, y: -6, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
  });
  eventCardEl.addEventListener('mouseleave', () => {
    gsap.to(eventCardEl, { scale: 1.0, y: 0, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
  });
}

/* =============================================
   RENDER LOOP
   ============================================= */
function animate() {
  requestAnimationFrame(animate);

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

animate();

/* =============================================
   WINDOW RESIZE
   ============================================= */
window.addEventListener('resize', () => {
  const newSize = getCanvasSize();
  camera.aspect = newSize.width / newSize.height;
  camera.updateProjectionMatrix();
  renderer.setSize(newSize.width, newSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  basePos.x = window.innerWidth <= 768 ? 0 : 2.0;
  basePos.y = window.innerWidth <= 768 ? 0.5 : 0.0;
  if (ball) {
    ball.position.set(basePos.x, basePos.y, basePos.z);
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
