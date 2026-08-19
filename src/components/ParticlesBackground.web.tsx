import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";

export type ParticlesHandle = {
  triggerBurst: (x?: number, y?: number) => void;
};

type Props = {
  intensity?: number;
  style?: "confetti" | "bubbles" | "stars";
  color?: string;
};

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  isBurst: boolean;
};

const BASE_COUNT = 120;
const BURST_COUNT = 55;

export const ParticlesBackground = forwardRef<ParticlesHandle, Props>(
  ({ intensity = 1, style = "confetti", color = "#a78bfa" }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const burstQueue = useRef<{ x: number; y: number }[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const geometryRef = useRef<THREE.BufferGeometry | null>(null);
    const materialRef = useRef<THREE.PointsMaterial | null>(null);

    useImperativeHandle(ref, () => ({
      triggerBurst: (x = 0, y = 0) => {
        burstQueue.current.push({ x, y });
      },
    }));

    useEffect(() => {
      if (!mountRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 50;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      mountRef.current.appendChild(renderer.domElement);

      const baseCount = Math.floor(BASE_COUNT * intensity);
      const maxCount = baseCount + BURST_COUNT * 3;
      const positions = new Float32Array(maxCount * 3);
      const colors = new Float32Array(maxCount * 3);
      const sizes = new Float32Array(maxCount);

      const baseColor = new THREE.Color(color);
      const particles: Particle[] = [];

      for (let i = 0; i < baseCount; i++) {
        const p: Particle = {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 80,
          z: (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 0.12,
          vy: style === "bubbles" ? Math.random() * 0.18 + 0.04 : -(Math.random() * 0.22 + 0.04),
          vz: (Math.random() - 0.5) * 0.08,
          life: 1,
          maxLife: 1,
          isBurst: false,
        };
        particles.push(p);
      }

      const updateBuffers = () => {
        for (let i = 0; i < maxCount; i++) {
          if (i < particles.length) {
            const p = particles[i];
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;

            const lifeRatio = p.isBurst ? p.life / p.maxLife : 1;
            colors[i * 3] = baseColor.r;
            colors[i * 3 + 1] = baseColor.g;
            colors[i * 3 + 2] = baseColor.b;
            sizes[i] = (p.isBurst ? 2.2 : style === "stars" ? 0.7 : 1.3) * lifeRatio;
          } else {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            sizes[i] = 0;
          }
        }
      };

      updateBuffers();

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
      geometryRef.current = geometry;

      const material = new THREE.PointsMaterial({
        size: 1.4,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      materialRef.current = material;

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      particlesRef.current = particles;

      const spawnBurst = (cx: number, cy: number) => {
        for (let i = 0; i < BURST_COUNT; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 1.8 + 0.6;
          const p: Particle = {
            x: cx + (Math.random() - 0.5) * 4,
            y: cy + (Math.random() - 0.5) * 4,
            z: (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: (Math.random() - 0.5) * 0.8,
            life: 1,
            maxLife: 0.9 + Math.random() * 0.5,
            isBurst: true,
          };
          particles.push(p);
        }
      };

      let frameId: number;
      const animate = () => {
        frameId = requestAnimationFrame(animate);

        while (burstQueue.current.length > 0) {
          const b = burstQueue.current.shift()!;
          spawnBurst(b.x, b.y);
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];

          p.x += p.vx;
          p.y += p.vy;
          p.z += p.vz;

          if (p.isBurst) {
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.vy -= 0.02;
            p.life -= 0.016;

            if (p.life <= 0) {
              particles.splice(i, 1);
              continue;
            }
          } else {
            if (style === "bubbles") {
              if (p.y > 42) p.y = -42;
            } else {
              if (p.y < -42) {
                p.y = 42;
                p.x = (Math.random() - 0.5) * 100;
              }
            }
          }
        }

        while (particles.length > maxCount) {
          const idx = particles.findIndex((p) => p.isBurst);
          if (idx >= 0) particles.splice(idx, 1);
          else break;
        }

        updateBuffers();
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        geometry.attributes.size.needsUpdate = true;

        points.rotation.y += 0.0006;

        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        if (mountRef.current?.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    }, [intensity, style, color]);

    return (
      <div
        ref={mountRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
    );
  }
);

ParticlesBackground.displayName = "ParticlesBackground";
