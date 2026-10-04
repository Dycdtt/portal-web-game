let moveForward = 0, moveSide = 0;
let yaw = 0, pitch = 0;
let lookTouchId = null;
let touchStartX = 0, touchStartY = 0;

function setupJoystick() {
  const container = document.getElementById('joystick-container');
  const stick = document.getElementById('joystick-stick');
  let joystickTouchId = null;
  let centerX = 0, centerY = 0;

  container.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    const rect = container.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    updateJoystick(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    for (let touch of e.changedTouches) {
      if (touch.identifier === joystickTouchId) {
        updateJoystick(touch.clientX, touch.clientY);
      }
    }
  }, { passive: false });

  const resetJoystick = (e) => {
    for (let touch of e.changedTouches) {
      if (touch.identifier === joystickTouchId) {
        joystickTouchId = null;
        moveForward = 0;
        moveSide = 0;
        stick.style.transform = `translate(0px, 0px)`;
      }
    }
  };

  window.addEventListener('touchend', resetJoystick);
  window.addEventListener('touchcancel', resetJoystick);

  function updateJoystick(clientX, clientY) {
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let maxDist = 45;

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    moveSide = dx / maxDist;
    moveForward = -dy / maxDist;
  }
}

function setupTouchControls() {
  window.addEventListener('touchstart', (e) => {
    for (let touch of e.changedTouches) {
      if (touch.clientX > window.innerWidth / 2 && lookTouchId === null) {
        lookTouchId = touch.identifier;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    }
  });

  window.addEventListener('touchmove', (e) => {
    for (let touch of e.changedTouches) {
      if (touch.identifier === lookTouchId) {
        let deltaX = touch.clientX - touchStartX;
        let deltaY = touch.clientY - touchStartY;

        yaw -= deltaX * 0.004;
        pitch -= deltaY * 0.004;
        pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));

        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    }
  });

  const resetLook = (e) => {
    for (let touch of e.changedTouches) {
      if (touch.identifier === lookTouchId) {
        lookTouchId = null;
      }
    }
  };

  window.addEventListener('touchend', resetLook);
  window.addEventListener('touchcancel', resetLook);
}
