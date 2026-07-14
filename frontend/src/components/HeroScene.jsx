import { useEffect, useRef } from "react";
import * as THREE from "three";

export function HeroScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const constellation = new THREE.Group();
    constellation.position.set(1.8, -0.35, 0);
    scene.add(constellation);

    const primaryCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.8, -2.2, 0),
      new THREE.Vector3(-3.4, -1.65, 0.35),
      new THREE.Vector3(-2.1, -1.9, -0.1),
      new THREE.Vector3(-0.7, -0.85, 0.45),
      new THREE.Vector3(0.7, -0.15, 0),
      new THREE.Vector3(2.05, 1.2, 0.5),
      new THREE.Vector3(3.9, 2.15, 0.05)
    ]);
    const primaryGeometry = new THREE.TubeGeometry(primaryCurve, 128, 0.035, 8, false);
    const primaryMaterial = new THREE.MeshBasicMaterial({ color: 0xc9ff63, transparent: true, opacity: 0.88 });
    constellation.add(new THREE.Mesh(primaryGeometry, primaryMaterial));

    const shadowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.6, -1.7, -0.5),
      new THREE.Vector3(-3.1, -1.1, -0.35),
      new THREE.Vector3(-1.7, -1.5, -0.4),
      new THREE.Vector3(-0.15, -0.55, -0.35),
      new THREE.Vector3(1.55, 0.1, -0.45),
      new THREE.Vector3(3.55, 1.45, -0.35)
    ]);
    const shadowGeometry = new THREE.TubeGeometry(shadowCurve, 96, 0.018, 7, false);
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x56ddb0, transparent: true, opacity: 0.42 });
    constellation.add(new THREE.Mesh(shadowGeometry, shadowMaterial));

    const nodeGeometry = new THREE.SphereGeometry(0.085, 18, 18);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [0.08, 0.28, 0.49, 0.7, 0.9].forEach((position, index) => {
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
      node.position.copy(primaryCurve.getPoint(position));
      node.scale.setScalar(index === 4 ? 1.45 : 1);
      constellation.add(node);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.16 + index * 0.018, 0.009, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xc9ff63, transparent: true, opacity: 0.48 })
      );
      ring.position.copy(node.position);
      ring.rotation.x = Math.PI / 2;
      constellation.add(ring);
    });

    const particleCount = 80;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 10;
      particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 6;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0xdfffb0, size: 0.035, transparent: true, opacity: 0.46 })
    );
    constellation.add(particles);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.22;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.14;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const clock = new THREE.Clock();
    let frame;
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      constellation.rotation.y += (pointer.x - constellation.rotation.y) * 0.025;
      constellation.rotation.x += (-pointer.y - constellation.rotation.x) * 0.025;
      constellation.position.y = -0.35 + Math.sin(elapsed * 0.45) * 0.05;
      particles.rotation.z = elapsed * 0.009;
      constellation.children.forEach((child, index) => {
        if (child.geometry?.type === "TorusGeometry") {
          child.scale.setScalar(1 + Math.sin(elapsed * 1.4 + index) * 0.06);
        }
      });
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div aria-hidden="true" className="hero-scene" ref={mountRef} />;
}
