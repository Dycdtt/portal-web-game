let scene, camera, renderer;
let playerPos = new THREE.Vector3(0, 1.6, 12);
let hasPortalGun = true;
let bluePortalGroup = null;

// 移動與視角變數
let moveForward = 0;
let moveSide = 0;
let yaw = 0;
let pitch = 0;

// 手機雙觸控變數
let moveTouchId = null;
let lookTouchId = null;
let joystickOrigin = { x: 0, y: 0 };
let lastLookPos = { x: 0, y: 0 };

// 關卡物件
let cubes = [];
let buttons = [];
let heldCube = null;

let doorLeftHalf, doorRightHalf;
let isExitDoorOpen = false;

const gltfLoader = new THREE.GLTFLoader();

function init() {
  const container = document.getElementById('canvas-container') || document.body;
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111316);
  scene.fog = new THREE.FogExp2(0x111316, 0.03);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.copy(playerPos);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // 高精度 PBR 影調與陰影
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  setupHDREnvironment();

  // 光照系統
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xfff5ea, 2.0);
  mainLight.position.set(5, 12, 5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.bias = -0.0001;
  scene.add(mainLight);

  createPortalChamber();
  setupKeyboardAndMouse();
  setupMobileUIAndTouch();
  bindUIEvents();
  
  window.addEventListener('resize', onWindowResize);
  animate();
}

function setupHDREnvironment() {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x22262c);
  const light1 = new THREE.PointLight(0xffffff, 5, 20);
  light1.position.set(0, 5, 0);
  envScene.add(light1);
  
  scene.environment = pmremGenerator.fromScene(envScene).texture;
}

function createPortalChamber() {
  const wallMat = new THREE.MeshStandardMaterial({ 
    color: 0x73787e, 
    roughness: 0.3, 
    metalness: 0.2 
  });
  
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x22252a, 
    roughness: 0.15, 
    metalness: 0.5 
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), wallMat);
  ceiling.position.y = 12;
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  const createWall = (x, y, z, width, height, rotY) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    wall.position.set(x, y, z);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    scene.add(wall);
  };
  createWall(0, 6, -15, 30, 12, 0);
  createWall(0, 6, 15, 30, 12, Math.PI);
  createWall(-15, 6, 0, 30, 12, Math.PI/2);
  createWall(15, 6, 0, 30, 12, -Math.PI/2);

  createWallSigns();
  createIndicatorLines();

  buttons.push(createButton(-6, 0, 0));
  buttons.push(createButton(6, 0, 0));

  // 載入您本地的 cube1.glb 模型
  loadCubeOrFallback(-6, 0.6, 6);
  loadCubeOrFallback(6, 0.6, 6);

  createRoundDoor();
}

// 載入本地 cube1.glb 模型
function loadCubeOrFallback(x, y, z) {
  const modelUrl = 'assets/models/cubes/cube1.glb';

  gltfLoader.load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;
      model.position.set(x, y, z);
      
      // 根據 Sketchfab 同伴方塊比例調整大小
      model.scale.set(0.8, 0.8, 0.8);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(model);
      cubes.push(model);
      console.log('cube1.glb 模型載入成功！');
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        console.log(`模型載入進度: ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`);
      }
    },
    (error) => {
      console.error('cube1.glb 載入失敗，改用備用方塊:', error);
      const fallbackCube = createPBRCube(x, y, z);
      cubes.push(fallbackCube);
    }
  );
}

// 備用程序化 PBR 方塊
function createPBRCube(x, y, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#d0d3d4'; ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#3a3d40'; ctx.fillRect(32, 32, 448, 448);
  ctx.fillStyle = '#e8ebed'; ctx.fillRect(64, 64, 384, 384);
  
  ctx.fillStyle = '#ff66aa'; 
  ctx.beginPath();
  ctx.arc(256, 256, 80, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.25,
    metalness: 0.6,
  });

  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat);
  cube.position.set(x, y, z);
  cube.castShadow = true;
  cube.receiveShadow = true;
  scene.add(cube);
  return cube;
}

function createButton(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.2, 32), baseMat);
  base.position.y = 0.1;
  base.receiveShadow = true;
  group.add(base);

  const redMat = new THREE.MeshStandardMaterial({ color: 0xee2222, roughness: 0.1, metalness: 0.3 });
  const pressBtn = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.15, 32), redMat);
  pressBtn.position.y = 0.25;
  pressBtn.castShadow = true;
  group.add(pressBtn);

  scene.add(group);
  return { group, pressBtn, isPressed: false };
}

function createRoundDoor() {
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 3, -14.8);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.2 });
  const frame = new THREE.Mesh(new THREE.TorusGeometry(3, 0.8, 32, 64), frameMat);
  frame.castShadow = true;
  doorGroup.add(frame);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a8b9e, metalness: 0.8, roughness: 0.2 });
  doorLeftHalf = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.2), doorMat);
  doorLeftHalf.position.set(-1.5, 0, 0);
  doorLeftHalf.castShadow = true;
  doorGroup.add(doorLeftHalf);

  doorRightHalf = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.2), doorMat);
  doorRightHalf.position.set(1.5, 0, 0);
  doorRightHalf.castShadow = true;
  doorGroup.add(doorRightHalf);

  scene.add(doorGroup);
}

function createWallSigns() {
  const checkCanvas = document.createElement('canvas');
  checkCanvas.width = 256; checkCanvas.height = 256;
  const ctx = checkCanvas.getContext('2d');
  ctx.fillStyle = '#f09000'; ctx.fillRect(0,0,256,256);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 12; ctx.strokeRect(6,6,244,244);
  ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(60, 130); ctx.lineTo(110, 190); ctx.lineTo(200, 70); ctx.stroke();
  
  const checkTex = new THREE.CanvasTexture(checkCanvas);
  checkTex.encoding = THREE.sRGBEncoding;
  const checkMat = new THREE.MeshBasicMaterial({ map: checkTex });

  const signL = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), checkMat);
  signL.position.set(-5, 6, -14.9);
  scene.add(signL);

  const signR = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), checkMat);
  signR.position.set(5, 6, -14.9);
  scene.add(signR);

  const exitCanvas = document.createElement('canvas');
  exitCanvas.width = 512; exitCanvas.height = 256;
  const eCtx = exitCanvas.getContext('2d');
  eCtx.fillStyle = '#ffffff'; eCtx.fillRect(0,0,512,256);
  eCtx.fillStyle = '#111'; eCtx.font = 'bold 120px Arial';
  eCtx.fillText('↓ EXIT', 40, 170);

  const exitTex = new THREE.CanvasTexture(exitCanvas);
  exitTex.encoding = THREE.sRGBEncoding;
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: exitTex }));
  exitSign.position.set(0, 7.5, -14.9);
  scene.add(exitSign);
}

function createIndicatorLines() {
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
  for(let i=1; i<14; i++) {
    const dotL = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), dotMat);
    dotL.rotation.x = -Math.PI / 2;
    dotL.position.set(-6, 0.02, -i);
    scene.add(dotL);

    const dotR = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), dotMat);
    dotR.rotation.x = -Math.PI / 2;
    dotR.position.set(6, 0.02, -i);
    scene.add(dotR);
  }
}

// 📱 手機觸控控制 UI
function setupMobileUIAndTouch() {
  let uiContainer = document.getElementById('mobile-controls');
  if (uiContainer) uiContainer.remove();

  uiContainer = document.createElement('div');
  uiContainer.id = 'mobile-controls';
  uiContainer.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9998;';

  const joystickBase = document.createElement('div');
  joystickBase.id = 'joystick-base';
  joystickBase.style.cssText = 'position:absolute; bottom:20px; left:20px; width:120px; height:120px; background:rgba(255,255,255,0.15); border:2px solid rgba(255,255,255,0.4); border-radius:50%; pointer-events:auto; touch-action:none; backdrop-filter:blur(4px);';

  const joystickKnob = document.createElement('div');
  joystickKnob.id = 'joystick-knob';
  joystickKnob.style.cssText = 'position:absolute; top:35px; left:35px; width:50px; height:50px; background:rgba(0,210,255,0.85); border-radius:50%; pointer-events:none; box-shadow:0 0 10px rgba(0,210,255,0.5);';
  joystickBase.appendChild(joystickKnob);
  uiContainer.appendChild(joystickBase);

  const eBtn = document.createElement('div');
  eBtn.id = 'e-btn';
  eBtn.innerText = 'E';
  eBtn.style.cssText = 'position:absolute; bottom:30px; right:110px; width:70px; height:70px; border-radius:50%; background:rgba(255,170,0,0.85); color:white; font-weight:bold; font-size:22px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; pointer-events:auto; touch-action:none; backdrop-filter:blur(4px);';
  uiContainer.appendChild(eBtn);

  const fireBtn = document.createElement('div');
  fireBtn.id = 'fire-btn';
  fireBtn.innerText = '發射';
  fireBtn.style.cssText = 'position:absolute; bottom:30px; right:20px; width:75px; height:75px; border-radius:50%; background:rgba(0,180,255,0.85); color:white; font-weight:bold; font-size:16px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; pointer-events:auto; touch-action:none; backdrop-filter:blur(4px);';
  uiContainer.appendChild(fireBtn);

  document.body.appendChild(uiContainer);

  const triggerE = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    handleInteractE();
  };
  eBtn.addEventListener('touchstart', triggerE, { passive: false });
  eBtn.onclick = triggerE;

  const triggerFire = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    shootPortal();
  };
  fireBtn.addEventListener('touchstart', triggerFire, { passive: false });
  fireBtn.onclick = triggerFire;

  window.addEventListener('touchstart', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target;

      if (target === eBtn || target === fireBtn || target.closest('#overlay')) continue;

      if (touch.clientX < window.innerWidth / 2 && moveTouchId === null) {
        moveTouchId = touch.identifier;
        const rect = joystickBase.getBoundingClientRect();
        joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        updateJoystick(touch);
      } else if (touch.clientX >= window.innerWidth / 2 && lookTouchId === null) {
        lookTouchId = touch.identifier;
        lastLookPos = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === moveTouchId) {
        updateJoystick(touch);
      } else if (touch.identifier === lookTouchId) {
        const deltaX = touch.clientX - lastLookPos.x;
        const deltaY = touch.clientY - lastLookPos.y;
        
        yaw -= deltaX * 0.005;
        pitch -= deltaY * 0.005;
        pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
        
        lastLookPos = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, { passive: false });

  const stopTouch = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === moveTouchId) {
        moveTouchId = null;
        moveForward = 0;
        moveSide = 0;
        joystickKnob.style.transform = `translate(0px, 0px)`;
      } else if (touch.identifier === lookTouchId) {
        lookTouchId = null;
      }
    }
  };

  window.addEventListener('touchend', stopTouch);
  window.addEventListener('touchcancel', stopTouch);

  function updateJoystick(touch) {
    const maxDist = 40;
    let dx = touch.clientX - joystickOrigin.x;
    let dy = touch.clientY - joystickOrigin.y;
    const dist = Math.hypot(dx, dy);

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveSide = dx / maxDist;
    moveForward = -dy / maxDist;
  }
}

function setupKeyboardAndMouse() {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveForward = 1;
    if (e.code === 'KeyS') moveForward = -1;
    if (e.code === 'KeyA') moveSide = -1;
    if (e.code === 'KeyD') moveSide = 1;
    if (e.code === 'KeyE') handleInteractE();
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'KeyS') moveForward = 0;
    if (e.code === 'KeyA' || e.code === 'KeyD') moveSide = 0;
  });
}

function handleInteractE() {
  if (heldCube) {
    heldCube.position.y = 0.6;
    heldCube = null;
    showSubtitle("已放下重力方塊。");
    return;
  }

  let closestCube = null;
  let minDistance = 4.0;

  cubes.forEach(cube => {
    const dist = playerPos.distanceTo(cube.position);
    if (dist < minDistance) {
      minDistance = dist;
      closestCube = cube;
    }
  });

  if (closestCube) {
    heldCube = closestCube;
    showSubtitle("已拿起重力方塊！請搬到紅色按鈕上。");
  } else {
    showSubtitle("請靠近方塊後再按 E。");
  }
}

function shootPortal() {
  if (!hasPortalGun) return;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const hit = intersects[0];

    if (!bluePortalGroup) {
      bluePortalGroup = new THREE.Group();
      const innerGeo = new THREE.RingGeometry(0.05, 0.7, 64);
      const innerMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide });
      bluePortalGroup.add(new THREE.Mesh(innerGeo, innerMat));

      const portalLight = new THREE.PointLight(0x00d2ff, 2.5, 6);
      bluePortalGroup.add(portalLight);
      scene.add(bluePortalGroup);
    }

    const normal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion);
    bluePortalGroup.position.copy(hit.point).add(normal.clone().multiplyScalar(0.02));
    bluePortalGroup.lookAt(bluePortalGroup.position.clone().add(normal));

    showSubtitle("[已發射藍色傳送門]");
  }
}

function bindUIEvents() {
  const startBtn = document.getElementById('start-btn');
  const overlay = document.getElementById('overlay');

  if (startBtn) {
    const startGame = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (overlay) {
        overlay.style.display = 'none';
      }

      showSubtitle("靠近方塊按 E 拿起，放到按鈕上！");
    };

    startBtn.addEventListener('touchstart', startGame, { passive: false });
    startBtn.addEventListener('click', startGame);
  }
}

function showSubtitle(text) {
  let sub = document.getElementById('subtitles');
  if (!sub) {
    sub = document.createElement('div');
    sub.id = 'subtitles';
    sub.style.cssText = 'position:fixed; top:20px; width:100%; text-align:center; color:white; font-size:16px; font-weight:bold; text-shadow:2px 2px 4px #000; pointer-events:none; z-index:10000;';
    document.body.appendChild(sub);
  }
  sub.innerText = text;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateGameLogic() {
  if (heldCube) {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);
    const targetPos = playerPos.clone().add(dir.multiplyScalar(2.2));
    targetPos.y = Math.max(0.6, targetPos.y); 
    heldCube.position.lerp(targetPos, 0.2);
  }

  let pressedCount = 0;

  buttons.forEach(btnObj => {
    let isPressedNow = false;
    
    cubes.forEach(cube => {
      if (cube.position.distanceTo(btnObj.group.position) < 1.5 && cube.position.y < 1.5) {
        isPressedNow = true;
      }
    });

    if (playerPos.distanceTo(btnObj.group.position) < 1.5) {
      isPressedNow = true;
    }

    if (isPressedNow) {
      btnObj.pressBtn.position.y = 0.15;
      btnObj.pressBtn.material.color.setHex(0xff5555);
      pressedCount++;
    } else {
      btnObj.pressBtn.position.y = 0.25;
      btnObj.pressBtn.material.color.setHex(0xcc1111);
    }
  });

  if (pressedCount === 2) {
    if (!isExitDoorOpen) {
      isExitDoorOpen = true;
      showSubtitle("🔴🔴 兩個按鈕皆已激活！出口門已開啟！");
    }
  } else {
    isExitDoorOpen = false;
  }

  if (isExitDoorOpen) {
    if (doorLeftHalf.position.x > -3.0) doorLeftHalf.position.x -= 0.05;
    if (doorRightHalf.position.x < 3.0) doorRightHalf.position.x += 0.05;
  } else {
    if (doorLeftHalf.position.x < -1.5) doorLeftHalf.position.x += 0.05;
    if (doorRightHalf.position.x > 1.5) doorRightHalf.position.x -= 0.05;
  }

  if (isExitDoorOpen && playerPos.distanceTo(new THREE.Vector3(0, 1.6, -14)) < 2.0) {
    showSubtitle("🎉 恭喜通關！");
  }
}

function animate() {
  requestAnimationFrame(animate);

  const dir = new THREE.Vector3(moveSide, 0, -moveForward);
  if (dir.length() > 0) {
    dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    playerPos.addScaledVector(dir, 0.1);
  }

  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  playerPos.x = Math.max(-14, Math.min(14, playerPos.x));
  playerPos.z = Math.max(-14, Math.min(14, playerPos.z));

  if (!isExitDoorOpen && playerPos.z < -12 && Math.abs(playerPos.x) < 3) {
    playerPos.z = -12;
  }

  camera.position.copy(playerPos);

  updateGameLogic();
  renderer.render(scene, camera);
}

window.onload = init;
