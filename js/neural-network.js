import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const canvas = document.getElementById('neuralCanvas');
const stage = document.getElementById('threeStage');
const fallback = document.getElementById('webglFallback');

if (!canvas || !stage) {
  // Page can still function normally without the hero canvas.
} else {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const lowPower = coarsePointer || window.innerWidth < 720;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    fallback.hidden = false;
    canvas.hidden = true;
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.7));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    camera.position.set(0, 0.1, 7.4);

    const network = new THREE.Group();
    scene.add(network);

    const nodeGeometry = new THREE.SphereGeometry(lowPower ? .065 : .075, 12, 12);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xa7ff49 });
    const secondaryNodeMaterial = new THREE.MeshBasicMaterial({ color: 0x48e6d0 });
    const dimNodeMaterial = new THREE.MeshBasicMaterial({ color: 0xaab7b0, transparent: true, opacity: .68 });

    const layerX = [-2.7, -1.35, 0, 1.35, 2.7];
    const counts = lowPower ? [4, 5, 5, 4, 3] : [5, 7, 8, 6, 4];
    const nodePositions = [];
    const nodesByLayer = [];

    counts.forEach((count, layerIndex) => {
      const layerNodes = [];
      const spread = count > 1 ? 3.2 / (count - 1) : 0;
      for (let i = 0; i < count; i += 1) {
        const y = count === 1 ? 0 : 1.6 - i * spread;
        const z = Math.sin((i + 1) * 1.7 + layerIndex * .75) * .42;
        const position = new THREE.Vector3(layerX[layerIndex], y, z);
        const material = layerIndex === 2 && i % 3 === 0 ? secondaryNodeMaterial : (i + layerIndex) % 4 === 0 ? dimNodeMaterial : nodeMaterial;
        const mesh = new THREE.Mesh(nodeGeometry, material);
        mesh.position.copy(position);
        network.add(mesh);
        layerNodes.push(mesh);
        nodePositions.push(position.clone());
      }
      nodesByLayer.push(layerNodes);
    });

    const linePositions = [];
    for (let layer = 0; layer < nodesByLayer.length - 1; layer += 1) {
      const fromLayer = nodesByLayer[layer];
      const toLayer = nodesByLayer[layer + 1];
      fromLayer.forEach((fromNode, i) => {
        toLayer.forEach((toNode, j) => {
          const keep = lowPower ? ((i * 3 + j * 5 + layer) % 3 === 0) : ((i + j + layer) % 2 === 0);
          if (!keep) return;
          linePositions.push(fromNode.position.x, fromNode.position.y, fromNode.position.z);
          linePositions.push(toNode.position.x, toNode.position.y, toNode.position.z);
        });
      });
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x6e8f7c, transparent: true, opacity: lowPower ? .2 : .25 });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    network.add(lines);

    const shellGeometry = new THREE.BufferGeometry();
    const shellPoints = [];
    const shellCount = lowPower ? 70 : 130;
    for (let i = 0; i < shellCount; i += 1) {
      const radius = 3.2 + Math.random() * 1.2;
      const angle = Math.random() * Math.PI * 2;
      shellPoints.push(
        Math.cos(angle) * radius,
        (Math.random() - .5) * 4.5,
        Math.sin(angle) * radius * .34
      );
    }
    shellGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shellPoints, 3));
    const shellMaterial = new THREE.PointsMaterial({ color: 0x7fbf98, size: lowPower ? .018 : .025, transparent: true, opacity: .32, sizeAttenuation: true });
    const shell = new THREE.Points(shellGeometry, shellMaterial);
    network.add(shell);

    const pulseGeometry = new THREE.SphereGeometry(.052, 10, 10);
    const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xe8ffcf });
    const pulseCount = lowPower ? 3 : 7;
    const pulses = [];
    for (let i = 0; i < pulseCount; i += 1) {
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      network.add(pulse);
      pulses.push({ mesh: pulse, offset: i / pulseCount, row: i });
    }

    network.rotation.x = -.08;
    network.rotation.y = -.12;

    let targetRX = network.rotation.x;
    let targetRY = network.rotation.y;
    let visible = true;
    let frameId = null;
    let time = 0;

    const updateSize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      frameId = null;
      if (!visible) return;
      time += reducedMotion ? 0 : 0.008;

      if (!reducedMotion) {
        targetRY += 0.0007;
        network.rotation.x += (targetRX - network.rotation.x) * .035;
        network.rotation.y += (targetRY - network.rotation.y) * .035;
        shell.rotation.y -= .0009;

        pulses.forEach((pulse, index) => {
          const progress = (time * .22 + pulse.offset) % 1;
          const layerFloat = progress * (nodesByLayer.length - 1);
          const layerIndex = Math.min(Math.floor(layerFloat), nodesByLayer.length - 2);
          const localT = layerFloat - layerIndex;
          const fromLayer = nodesByLayer[layerIndex];
          const toLayer = nodesByLayer[layerIndex + 1];
          const fromNode = fromLayer[(pulse.row + index) % fromLayer.length];
          const toNode = toLayer[(pulse.row * 2 + index + 1) % toLayer.length];
          pulse.mesh.position.lerpVectors(fromNode.position, toNode.position, localT);
          pulse.mesh.scale.setScalar(.65 + Math.sin((progress + index) * Math.PI * 2) * .16);
        });
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    const start = () => {
      if (frameId === null && visible) frameId = requestAnimationFrame(animate);
    };
    const stop = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
    };

    if (!coarsePointer && !reducedMotion) {
      stage.addEventListener('pointermove', (event) => {
        const rect = stage.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width - .5;
        const ny = (event.clientY - rect.top) / rect.height - .5;
        targetRY = -.12 + nx * .34;
        targetRX = -.08 + ny * .2;
      }, { passive: true });
      stage.addEventListener('pointerleave', () => {
        targetRY = -.12;
        targetRX = -.08;
      });
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(updateSize).observe(stage);
    } else {
      window.addEventListener('resize', updateSize);
    }

    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start(); else stop();
      }, { threshold: .05 });
      visibilityObserver.observe(stage);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (visible) start();
    });

    updateSize();
    renderer.render(scene, camera);
    if (!reducedMotion) start();
  }
}
