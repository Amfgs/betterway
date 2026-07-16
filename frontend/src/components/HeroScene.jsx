import { useEffect, useRef } from "react";
import * as THREE from "three";

const STAGES = [
  { count: 2, color: 0x1a634b, x: -1.38, z: 0.08 },
  { count: 4, color: 0x16815b, x: -0.5, z: 0.2 },
  { count: 6, color: 0x20a976, x: 0.38, z: 0.12 },
  { count: 8, color: 0x4bd5a3, x: 1.26, z: 0.26 }
];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function easeOutQuint(value) {
  return 1 - Math.pow(1 - value, 5);
}

function createCoinTexture(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 384;
  const context = canvas.getContext("2d");

  context.fillStyle = "#0b5c43";
  context.fillRect(0, 0, 384, 384);
  context.strokeStyle = "#c9ff63";
  context.lineWidth = 12;
  context.beginPath();
  context.arc(192, 192, 154, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#efffcf";
  context.font = "900 126px Manrope, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("R$", 192, 184);
  context.font = "800 23px Manrope, Arial, sans-serif";
  context.fillText("APORTE", 192, 278);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

export function HeroScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const compactViewport = window.matchMedia("(max-width: 767px)").matches;
    if (!mount || compactViewport) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
    camera.position.set(0, 0.05, 10.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    const financialPath = new THREE.Group();
    root.add(financialPath);
    scene.add(root);

    const coinTexture = createCoinTexture(renderer);
    const coinGeometry = new THREE.CylinderGeometry(0.31, 0.31, 0.12, 48, 2, false);
    const rimGeometry = new THREE.TorusGeometry(0.286, 0.012, 8, 48);
    rimGeometry.rotateX(Math.PI / 2);
    const topFaceGeometry = new THREE.CircleGeometry(0.255, 48);
    topFaceGeometry.rotateX(-Math.PI / 2);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xa3f2cc,
      emissive: 0x164e3b,
      emissiveIntensity: 0.35,
      metalness: 0.48,
      roughness: 0.28
    });
    const topFaceMaterial = new THREE.MeshBasicMaterial({ map: coinTexture });
    const stackCoins = [];
    let order = 0;

    STAGES.forEach((stage, stageIndex) => {
      const material = new THREE.MeshPhysicalMaterial({
        clearcoat: 0.72,
        clearcoatRoughness: 0.18,
        color: stage.color,
        metalness: 0.36,
        roughness: 0.25
      });

      for (let index = 0; index < stage.count; index += 1) {
        const coin = new THREE.Group();
        const body = new THREE.Mesh(coinGeometry, material);
        const upperRim = new THREE.Mesh(rimGeometry, rimMaterial);
        const lowerRim = new THREE.Mesh(rimGeometry, rimMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        upperRim.position.y = 0.061;
        lowerRim.position.y = -0.061;
        coin.add(body, upperRim, lowerRim);

        if (index === stage.count - 1) {
          const face = new THREE.Mesh(topFaceGeometry, topFaceMaterial);
          face.position.y = 0.063;
          coin.add(face);
        }

        const targetY = -1.02 + index * 0.128;
        coin.position.set(stage.x, targetY, stage.z);
        coin.rotation.y = (stageIndex - 1.5) * 0.08;
        coin.userData = { delay: order * 0.045, targetY };
        stackCoins.push(coin);
        financialPath.add(coin);
        order += 1;
      }
    });

    const growthArrow = new THREE.Group();
    growthArrow.position.set(1.26, 0.1, 0.2);
    const growthMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9ff63,
      emissive: 0x56871d,
      emissiveIntensity: 0.68,
      metalness: 0.3,
      roughness: 0.24
    });
    const arrowStem = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.3, 0.065), growthMaterial);
    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 4), growthMaterial);
    arrowStem.position.y = -0.1;
    arrowHead.position.y = 0.13;
    arrowHead.rotation.y = Math.PI / 4;
    growthArrow.add(arrowStem, arrowHead);
    financialPath.add(growthArrow);

    const transferCoin = new THREE.Group();
    const transferBodyGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.075, 48, 2, false);
    transferBodyGeometry.rotateX(Math.PI / 2);
    const transferBodyMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.85,
      color: 0x27ca91,
      metalness: 0.42,
      opacity: 1,
      roughness: 0.2,
      transparent: true
    });
    const transferFaceMaterial = new THREE.MeshBasicMaterial({ map: coinTexture, opacity: 1, transparent: true });
    const transferRimMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8ff8a,
      emissive: 0x689d22,
      emissiveIntensity: 0.6,
      opacity: 1,
      transparent: true
    });
    const transferBody = new THREE.Mesh(transferBodyGeometry, transferBodyMaterial);
    const transferFace = new THREE.Mesh(new THREE.CircleGeometry(0.225, 48), transferFaceMaterial);
    const transferRim = new THREE.Mesh(new THREE.TorusGeometry(0.231, 0.014, 8, 48), transferRimMaterial);
    transferFace.position.z = 0.039;
    transferRim.position.z = 0.043;
    transferBody.castShadow = true;
    transferCoin.add(transferBody, transferFace, transferRim);
    financialPath.add(transferCoin);

    const transferPath = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-1.38, -0.72, 0.72),
      new THREE.Vector3(-0.7, -0.15, 1.02),
      new THREE.Vector3(0.54, 0.18, 0.92),
      new THREE.Vector3(1.26, 0.1, 0.68)
    );

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4.1, 2.5),
      new THREE.ShadowMaterial({ opacity: 0.19, transparent: true })
    );
    floor.position.set(0, -1.1, 0);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    scene.add(new THREE.HemisphereLight(0xd5ffeb, 0x03120d, 1.15));
    const keyLight = new THREE.DirectionalLight(0xf4fff8, 2.3);
    keyLight.position.set(-3.6, 5.4, 6.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(0x74f3c2, 16, 7, 1.8);
    accentLight.position.set(2.3, 1.2, 3.3);
    scene.add(accentLight);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!reducedMotion) window.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;

      if (width < 980) {
        root.position.set(2.62, -1.22, 0);
        root.scale.setScalar(0.45);
      } else {
        root.position.set(4.18, -1.54, 0);
        root.scale.setScalar(0.54);
      }
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const clock = new THREE.Clock();
    let frame;
    const renderFrame = (forcedElapsed) => {
      const elapsed = forcedElapsed ?? clock.getElapsedTime();
      const entrance = reducedMotion ? 1 : easeOutQuint(clamp01(elapsed / 1.45));
      const targetRotationX = -0.1 + pointer.y * 0.018;
      const targetRotationY = -0.16 + pointer.x * 0.045;
      financialPath.rotation.x += (targetRotationX - financialPath.rotation.x) * 0.035;
      financialPath.rotation.y += (targetRotationY - financialPath.rotation.y) * 0.035;
      financialPath.position.y = reducedMotion ? 0 : Math.sin(elapsed * 0.52) * 0.024;

      stackCoins.forEach((coin) => {
        const coinEntrance = reducedMotion ? 1 : easeOutQuint(clamp01((elapsed - coin.userData.delay) / 0.9));
        coin.position.y = THREE.MathUtils.lerp(-1.75, coin.userData.targetY, coinEntrance);
        coin.scale.setScalar(Math.max(coinEntrance, 0.001));
      });

      const progress = reducedMotion ? 0.82 : (elapsed * 0.105) % 1;
      const visibility = reducedMotion ? 1 : Math.min(1, progress * 12, (1 - progress) * 12);
      transferCoin.position.copy(transferPath.getPoint(progress));
      transferCoin.rotation.z = reducedMotion ? -0.18 : -elapsed * 2.4;
      transferCoin.scale.setScalar(Math.max(entrance * (0.88 + Math.sin(Math.PI * progress) * 0.12), 0.001));
      transferBodyMaterial.opacity = visibility;
      transferFaceMaterial.opacity = visibility;
      transferRimMaterial.opacity = visibility;

      const arrowPulse = reducedMotion ? 1 : 1 + Math.sin(elapsed * 1.7) * 0.025;
      growthArrow.scale.setScalar(entrance * arrowPulse);
      renderer.render(scene, camera);
      if (!reducedMotion) frame = window.requestAnimationFrame(() => renderFrame());
    };
    renderFrame(reducedMotion ? 4 : undefined);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
        else if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      coinTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div aria-hidden="true" className="hero-scene" ref={mountRef} />;
}
