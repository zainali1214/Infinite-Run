import './style.css';
import * as THREE from 'three';

// --- SEAMLESS RENDER PIPELINE ---
let scene, camera, renderer;
let player, trackPieces = [], obstacles = [], crystals = [], monoliths = [], particles = [];

const TRACK_WIDTH = 19; 
const TRACK_LENGTH = 160;

let gameActive = false;
let introSequenceActive = true;
let introTimer = 0;

let score = 0, crystalCount = 0;
let speed = 0.0, maxSpeed = 4.3, acceleration = 0.0009;
let shakeIntensity = 0;
let timeGlobal = 0;

// Kinematic Squash & Stretch Scale Vectors
let targetScale = new THREE.Vector3(1, 1, 1);
let currentScale = new THREE.Vector3(1, 1, 1);

// Physics Traversal Vectors
let isJumping = false, jumpVelocity = 0;
let rollAngle = 0;
const gravity = 0.016, jumpForce = 0.38;
const keys = { Left: false, Right: false };

// Overlay Elements Cache
const screenOverlay = document.getElementById('screen-overlay');
const viewStart = document.getElementById('view-start');
const viewOver = document.getElementById('view-over');
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');

const scoreDisplay = document.getElementById('score-display');
const crystalsDisplay = document.getElementById('crystals-display');

// Shading Vector Variables
let colorBg = new THREE.Color(0xe5e5e0);
let colorPlayer = new THREE.Color(0x131415);
let colorObstacle = new THREE.Color(0x131415);
let colorPoint = new THREE.Color(0xbfa154);
let colorMonolith = new THREE.Color(0xd1d1cc);

function init() {
    scene = new THREE.Scene();
    scene.background = colorBg;
    scene.fog = new THREE.FogExp2(colorBg, 0.022); 

    camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4.5, 9.2); 

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Studio Rig Lighting Matrix
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xfffef2, 0.65);
    directionalLight1.position.set(30, 60, 15);
    scene.add(directionalLight1);

    const fillLight = new THREE.DirectionalLight(0x9cbcf2, 0.25);
    fillLight.position.set(-30, 30, -15);
    scene.add(fillLight);

    // Core Player Mesh Sphere
    const playerGeo = new THREE.SphereGeometry(0.56, 32, 32);
    const playerMat = new THREE.MeshStandardMaterial({ color: colorPlayer, roughness: 0.08, metalness: 0.25 });
    player = new THREE.Mesh(playerGeo, playerMat);
    
    // Placed high up to kick off the fluid drop-in intro sequence immediately
    player.position.set(0, 7.5, 0); 
    scene.add(player);

    buildBeautifulTrack(0);
    buildBeautifulTrack(-TRACK_LENGTH);
    buildPureCanyonEnvironment();

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    startBtn.addEventListener('click', initializeGameActivation);
    retryBtn.addEventListener('click', initializeGameActivation);

    animate();
}

// --- CORE GEOMETRIC BUILD ARCHITECTS ---
function buildBeautifulTrack(zOffset) {
    const containerGroup = new THREE.Group();
    containerGroup.position.z = zOffset;

    const baseGeo = new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.6, metalness: 0.25 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.rotation.x = -Math.PI / 2;
    containerGroup.add(baseMesh);

    const laneWidth = (TRACK_WIDTH - 1.6) / 3;
    const runwayGeo = new THREE.PlaneGeometry(laneWidth, TRACK_LENGTH);
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0xe6e6e2, roughness: 0.14, metalness: 0.15 });

    for(let i = 0; i < 3; i++) {
        const laneMesh = new THREE.Mesh(runwayGeo, runwayMat.clone());
        let posX = (i - 1) * (laneWidth + 0.4);
        laneMesh.position.set(posX, 0.01, -TRACK_LENGTH / 2);
        laneMesh.rotation.x = -Math.PI / 2;
        containerGroup.add(laneMesh);
        trackPieces.push(laneMesh); 
    }

    const curbGeo = new THREE.BoxGeometry(0.25, 0.3, TRACK_LENGTH);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.4 });
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-TRACK_WIDTH/2, 0.15, -TRACK_LENGTH / 2);
    rightCurb.position.set(TRACK_WIDTH/2, 0.15, -TRACK_LENGTH / 2);
    
    containerGroup.add(leftCurb, rightCurb);
    scene.add(containerGroup);
    trackPieces.push(containerGroup);
}

function buildPureCanyonEnvironment() {
    const buildingCount = 140; 
    for (let i = 0; i < buildingCount; i++) {
        const w = Math.random() * 8 + 18;
        const h = Math.random() * 90 + 60;
        const d = Math.random() * 12 + 18;
        
        const building = new THREE.Group();
        const mainMat = new THREE.MeshStandardMaterial({ color: colorMonolith, roughness: 0.55, metalness: 0.05 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xb4b4af, roughness: 0.7 });

        const baseGeo = new THREE.BoxGeometry(w, h, d);
        const baseMesh = new THREE.Mesh(baseGeo, mainMat);
        building.add(baseMesh);

        const floors = Math.floor(Math.random() * 5) + 4;
        for (let j = 0; j < floors; j++) {
            const slabGeo = new THREE.BoxGeometry(w + 0.25, h * 0.018, d + 0.25);
            const slabMesh = new THREE.Mesh(slabGeo, trimMat);
            slabMesh.position.y = (j - (floors-1)/2) * (h / (floors + 1));
            building.add(slabMesh);
        }

        let side = Math.random() > 0.5 ? 1 : -1;
        let canyonEdgeX = side * (TRACK_WIDTH / 2 + w / 2 + Math.random() * 4 + 1.0);
        building.position.set(canyonEdgeX, h / 2, -Math.random() * TRACK_LENGTH * 2.5);
        
        scene.add(building);
        monoliths.push(building);
    }
}

function spawnObstacle(zPos) {
    let progression = Math.min(score / 32000, 1.0); 
    let dynamicScale = 1.0 + (progression * 0.45); 

    const width = (Math.random() * 1.6 + 2.8) * dynamicScale;
    const h = 2.4 * dynamicScale;
    const obstacleGroup = new THREE.Group();
    
    const baseGeo = new THREE.BoxGeometry(width, h * 0.6, 1.6);
    const baseMat = new THREE.MeshStandardMaterial({ color: colorObstacle, roughness: 0.4 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = (h * 0.6) / 2;
    obstacleGroup.add(baseMesh);

    const ringGeo = new THREE.BoxGeometry(width + 0.1, h * 0.08, 1.7);
    const ringMat = new THREE.MeshStandardMaterial({ color: colorPoint, roughness: 0.2, metalness: 0.6 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = h * 0.4;
    obstacleGroup.add(ringMesh);

    const apexGeo = new THREE.OctahedronGeometry(0.45 * dynamicScale, 0);
    const apexMat = new THREE.MeshStandardMaterial({ color: colorPoint, roughness: 0.1, metalness: 0.8 });
    const apexMesh = new THREE.Mesh(apexGeo, apexMat);
    apexMesh.position.y = h + 0.3;
    obstacleGroup.add(apexMesh);

    obstacleGroup.position.set((Math.random() - 0.5) * (TRACK_WIDTH - width - 3.5), 0, zPos);
    obstacleGroup.userData = { hitChecked: false, width: width, apexMesh: apexMesh, ringMesh: ringMesh };
    
    scene.add(obstacleGroup);
    obstacles.push(obstacleGroup);
}

function spawnCrystal(zPos) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorPoint, roughness: 0.1, metalness: 0.9 });
    
    const geo1 = new THREE.IcosahedronGeometry(0.44, 0);
    const m1 = new THREE.Mesh(geo1, mat);
    const geo2 = new THREE.IcosahedronGeometry(0.22, 0);
    const m2 = new THREE.Mesh(geo2, mat);
    m2.position.y = 0.58;
    
    group.add(m1, m2);
    group.position.set((Math.random() - 0.5) * (TRACK_WIDTH - 5), 0.75, zPos);
    scene.add(group);
    crystals.push(group);
}

function createAsymmetricExplosion(pos, color) {
    const fragments = 12;
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.35 });
    for (let i = 0; i < fragments; i++) {
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);
        p.userData = {
            vx: (Math.random() - 0.5) * 0.26,
            vy: Math.random() * 0.24 + 0.05,
            vz: (Math.random() - 0.5) * 0.26 - (speed * 0.45),
            life: 30
        };
        scene.add(p);
        particles.push(p);
    }
}

function updateDynamicGlobalSpectrum() {
    let waveBg = (Math.sin(timeGlobal * 0.035) + 1) / 2;       
    let waveAccent = (Math.sin(timeGlobal * 0.065 + 4) + 1) / 2; 

    colorBg.setHSL(waveBg, 0.10, 0.92);
    scene.background = colorBg;
    scene.fog.color = colorBg;

    colorMonolith.setHSL(waveBg, 0.08, 0.82);
    monoliths.forEach(m => {
        m.children.forEach(child => child.material.color = colorMonolith);
    });

    colorObstacle.setHSL((waveBg + 0.5) % 1.0, 0.25, 0.38);
    colorPoint.setHSL(waveAccent, 0.65, 0.52);

    obstacles.forEach(o => {
        o.children[0].material.color = colorObstacle;
        if (o.userData.ringMesh) o.userData.ringMesh.material.color = colorPoint;
        if (o.userData.apexMesh) o.userData.apexMesh.material.color = colorPoint;
    });

    crystals.forEach(c => {
        c.children[0].material.color = colorPoint;
        c.children[1].material.color = colorPoint;
    });

    colorPlayer.setHSL((waveAccent + 0.4) % 1.0, 0.40, 0.24);
    player.material.color = colorPlayer;

    let runwayReflectedColor = new THREE.Color().setHSL(waveBg, 0.08, 0.88);
    trackPieces.forEach(element => {
        if(element.geometry && element.geometry.type === "PlaneGeometry") {
            element.material.color = runwayReflectedColor;
        }
    });
}

// --- MASTER FRAME EXECUTION TICK ---
function animate() {
    requestAnimationFrame(animate);
    timeGlobal += 0.012; 

    // LIVE PRE-GAME INSTANT FLUID INTRO MATRIX
    if (introSequenceActive) {
        updateDynamicGlobalSpectrum();

        // Smooth gravity down-slam animation frame mapping
        player.position.y = THREE.MathUtils.lerp(player.position.y, 0.56, 0.08);
        
        // Track landing collision frame check to snap squash configurations
        if (player.position.y <= 0.58 && currentScale.y > 0.9) {
            targetScale.set(1.5, 0.4, 1.5); // Snap smash compression
        } else {
            targetScale.lerp(new THREE.Vector3(1, 1, 1), 0.08); // Spring dampening recoil
        }

        // Slow structural rotation translation loop for idle background context
        trackPieces.forEach(element => {
            if (element.type === "Group") {
                element.position.z += 0.12;
                if (element.position.z > TRACK_LENGTH) element.position.z -= TRACK_LENGTH * 2;
            }
        });
        monoliths.forEach(m => {
            m.position.z += 0.12;
            if (m.position.z > 50) m.position.z = -TRACK_LENGTH * 2.5 - (Math.random() * 30);
        });
        camera.lookAt(player.position.x, 1.4, player.position.z - 4);
    }

    // CORE RACER SIMULATION LOOPS
    if (gameActive) {
        if (speed < maxSpeed) speed += acceleration;
        updateDynamicGlobalSpectrum();

        camera.fov = THREE.MathUtils.lerp(camera.fov, 44 + (speed * 110 * 0.08), 0.04);
        camera.updateProjectionMatrix();

        let targetRoll = 0;
        if (keys.Left && player.position.x > -TRACK_WIDTH / 2 + 1.0) {
            player.position.x -= 0.26;
            targetRoll = 0.32;
            targetScale.set(0.88, 1.0, 1.12); 
        }
        if (keys.Right && player.position.x < TRACK_WIDTH / 2 - 1.0) {
            player.position.x += 0.26;
            targetRoll = -0.32;
            targetScale.set(0.88, 1.0, 1.12);
        }
        if (!keys.Left && !keys.Right) {
            targetScale.set(1.0, 1.0, 1.0);
        }
        rollAngle = THREE.MathUtils.lerp(rollAngle, targetRoll, 0.1);

        // Kinematic Jump Vectors
        if (isJumping) {
            player.position.y += jumpVelocity;
            jumpVelocity -= gravity;
            targetScale.set(0.85, 1.2, 0.85); 
            if (player.position.y <= 0.56) {
                player.position.y = 0.56; isJumping = false; jumpVelocity = 0;
                targetScale.set(1.35, 0.6, 1.35); 
                shakeIntensity = 0.06;
            }
        }

        // Elastic Camera Rig Physics
        let noiseX = Math.sin(timeGlobal * 1.5) * 0.02;
        let noiseY = Math.cos(timeGlobal * 1.2) * 0.015;

        if (shakeIntensity > 0) {
            camera.position.x = (player.position.x * 0.28) + (Math.random() - 0.5) * shakeIntensity + noiseX;
            camera.position.y = 4.5 + (Math.random() - 0.5) * shakeIntensity + noiseY;
            shakeIntensity *= 0.86;
        } else {
            camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.28 + noiseX, 0.08);
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.5 + (player.position.y * 0.12) + noiseY, 0.08);
        }
        camera.position.z = 9.2 + rollAngle * 0.4;
        camera.lookAt(player.position.x * 0.1, 1.2 + (player.position.y * 0.05), player.position.z - 4.5);

        const playerBox = new THREE.Box3().setFromObject(player);

        // Obstacle Collision Core Checks
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i]; obs.position.z += speed;
            if (obs.userData.apexMesh) {
                obs.userData.apexMesh.rotation.y += 0.03;
            }
            const obsBox = new THREE.Box3().setFromObject(obs);
            if (playerBox.intersectsBox(obsBox)) triggerGameOver();

            // Edge Near-Miss System Tracking
            if (!obs.userData.hitChecked && obs.position.z >= player.position.z - 1.2 && obs.position.z <= player.position.z + 1.2) {
                let lateralDistance = Math.abs(player.position.x - obs.position.x) - (obs.userData.width / 2 + 0.56);
                if (lateralDistance > -0.05 && lateralDistance < 0.45 && !isJumping) {
                    obs.userData.hitChecked = true;
                    score += 500;
                    shakeIntensity = 0.24;
                    targetScale.set(1.2, 1.2, 1.2); 
                    createAsymmetricExplosion(player.position, colorPoint);
                }
            }
            if (obs.position.z > 20) {
                scene.remove(obs); obstacles.splice(i, 1);
                const farthestZ = obstacles.reduce((min, o) => o.position.z < min ? o.position.z : min, 0);
                spawnObstacle(farthestZ - (34 + Math.random() * 12));
            }
        }

        // Crystals Reclaim Passes
        for (let i = crystals.length - 1; i >= 0; i--) {
            const cry = crystals[i]; cry.position.z += speed; 
            cry.rotation.y += 0.02;
            const cryBox = new THREE.Box3().setFromObject(cry);

            if (playerBox.intersectsBox(cryBox)) {
                createAsymmetricExplosion(cry.position, colorPoint);
                scene.remove(cry); crystals.splice(i, 1);
                crystalCount++; score += 250;
                crystalsDisplay.innerText = "NODES // " + crystalCount;

                const farthestZ = crystals.reduce((min, c) => c.position.z < min ? c.position.z : min, 0);
                spawnCrystal(farthestZ - (32 + Math.random() * 14));
                continue;
            }
            if (cry.position.z > 20) {
                scene.remove(cry); crystals.splice(i, 1);
                const farthestZ = crystals.reduce((min, c) => c.position.z < min ? c.position.z : min, 0);
                spawnCrystal(farthestZ - 40);
            }
        }

        // Particle Vector Core Matrix Updates
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.position.x += p.userData.vx; p.position.y += p.userData.vy; p.position.z += p.userData.vz + speed;
            p.userData.life--;
            if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
        }

        trackPieces.forEach(element => {
            if (element.type === "Group") {
                element.position.z += speed;
                if (element.position.z > TRACK_LENGTH) element.position.z -= TRACK_LENGTH * 2;
            }
        });
        monoliths.forEach(m => {
            m.position.z += speed; 
            if (m.position.z > 50) m.position.z = -TRACK_LENGTH * 2.5 - (Math.random() * 30);
        });

        score += 1;
        scoreDisplay.innerText = "SEQ // " + String(score).padStart(5, '0');
        player.rotation.x -= speed * 0.2;
        player.rotation.z = rollAngle * 0.4;
    }

    // Continuous Linear Interpolator Framework for Squash & Stretch Physics
    currentScale.lerp(targetScale, 0.2);
    player.scale.copy(currentScale);

    renderer.render(scene, camera);
}

// --- DEVICE REGISTRATION LISTENERS ---
function handleKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.Left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.Right = true;
    if (e.key === ' ' && !isJumping && gameActive) {
        isJumping = true; jumpVelocity = jumpForce;
    }
    // Bind instantaneous system restart loops on spacebar press across menu states
    if (e.key === ' ' && !gameActive && !introSequenceActive) {
        initializeGameActivation();
    }
}

function handleKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.Left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.Right = false;
}

function initializeGameActivation() {
    // Drop HUD layers and hide viewports instantly without frame delays
    viewStart.classList.remove('active');
    viewOver.classList.remove('active');
    screenOverlay.style.display = 'none';
    introSequenceActive = false;

    // Reset Engine Constants Instantly
    score = 0; crystalCount = 0; speed = 1.4;
    player.position.set(0, 0.56, 0); isJumping = false; jumpVelocity = 0;
    targetScale.set(1,1,1); currentScale.set(1,1,1);

    scoreDisplay.innerText = "SEQ // 00000";
    crystalsDisplay.innerText = "NODES // 0";

    obstacles.forEach(obs => scene.remove(obs));
    crystals.forEach(cry => scene.remove(cry));
    particles.forEach(p => scene.remove(p));
    obstacles = []; crystals = []; particles = [];

    for (let i = 0; i < 4; i++) {
        spawnObstacle(-45 - (i * 35));
        spawnCrystal(-30 - (i * 45));
    }
    gameActive = true;
}

function triggerGameOver() {
    gameActive = false;
    
    let storedRecord = localStorage.getItem('infinite_run_flat_high') || 0;
    storedRecord = parseInt(storedRecord);

    if (score > storedRecord) {
        storedRecord = score;
        localStorage.setItem('infinite_run_flat_high', storedRecord);
    }

    // Sync raw values immediately into flat typography fields
    document.getElementById('m-score').innerText = String(score).padStart(5, '0');
    document.getElementById('m-speed').innerText = (speed * 220).toFixed(0) + " KT";
    document.getElementById('m-peak').innerText = String(storedRecord).padStart(5, '0');

    // Swap viewframes instantly—zero transition layout stutter
    screenOverlay.style.display = 'flex';
    viewOver.classList.add('active');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;