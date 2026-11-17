"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef } from "react";
import layout from "./voxel-layout.json";

const { aspect, layers, eyes, pivot } = layout;

type Layer = { left: number; top: number; width: number; height: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const layerStyle = (l: Layer) => ({
  position: "absolute" as const,
  left: `${l.left}%`,
  top: `${l.top}%`,
  width: `${l.width}%`,
  height: `${l.height}%`,
});

/** Pivot (in canvas %) converted to a 0..1 origin relative to a layer box. */
const originIn = (l: Layer, p: number[]) => ({
  x: (p[0] - l.left) / l.width,
  y: (p[1] - l.top) / l.height,
});

const SKIN = "rgb(237,191,152)";
const WAVE_ANGLE = -115;
const WAVE_AMPLITUDE = 17; // oscillates between -98 and -132
const WAVE_PERIOD = 0.55;
const WAVE_CYCLES = 4;

export default function VoxelCharacter({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  const bobY = useMotionValue(0);
  const sway = useMotionValue(0);
  const breathe = useMotionValue(1);
  const headRot = useMotionValue(0);
  const headY = useMotionValue(0);
  const armLRot = useMotionValue(0);
  const armRRot = useMotionValue(0);
  const blink = useMotionValue(0);

  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const lookX = useSpring(targetX, { stiffness: 140, damping: 20, mass: 0.6 });
  const lookY = useSpring(targetY, { stiffness: 140, damping: 20, mass: 0.6 });
  const pupilX = useTransform(lookX, (v) => `${clamp(v, -1, 1) * 46}%`);
  const pupilY = useTransform(lookY, (v) => `${clamp(v, -1, 1) * 6}%`);

  const waveState = useRef({ next: 0, start: -1 });
  const blinkState = useRef({ next: 0, start: -1 });

  // Pointer / touch tracking
  useEffect(() => {
    if (reduce) return;

    const update = (cx: number, cy: number) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width * 0.5;
      const ey = r.top + r.height * 0.22;
      targetX.set(clamp((cx - ex) / (window.innerWidth * 0.5), -1, 1));
      targetY.set(clamp((cy - ey) / (window.innerHeight * 0.5), -1, 1));
    };
    const onMouse = (e: MouseEvent) => update(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) update(t.clientX, t.clientY);
    };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [reduce, targetX, targetY]);

  // Single animation loop
  useAnimationFrame((time) => {
    if (reduce) return;
    const t = time / 1000;

    bobY.set(Math.sin(t * 1.6) * 3);
    sway.set(Math.sin(t * 0.8) * 0.9);
    breathe.set(1 + Math.sin(t * 1.9) * 0.006);

    headRot.set(Math.sin(t * 0.9 + 0.6) * 1.6 + clamp(lookX.get(), -1, 1) * 4);
    headY.set(Math.sin(t * 1.3) * 1.5 + clamp(lookY.get(), -1, 1) * 1.5);

    // Arms: gentle swing with offset phases
    armLRot.set(Math.sin(t * 1.6 + 0.4) * 3);
    const baseR = Math.sin(t * 1.6 + 0.4 + Math.PI * 0.9) * 3;

    // Wave hello (right arm) every 7-12 seconds
    const w = waveState.current;
    if (w.next === 0) w.next = time + rand(7000, 12000);
    if (w.start < 0 && time >= w.next) w.start = time;

    let armR = baseR;
    if (w.start >= 0) {
      const e = (time - w.start) / 1000;
      const up = 0.6;
      const hold = WAVE_PERIOD * WAVE_CYCLES;
      const down = 0.6;
      if (e < up) {
        armR = lerp(baseR, WAVE_ANGLE, ease(e / up));
      } else if (e < up + hold) {
        const s = e - up;
        armR = WAVE_ANGLE + Math.sin((s / WAVE_PERIOD) * Math.PI * 2) * WAVE_AMPLITUDE;
      } else if (e < up + hold + down) {
        armR = lerp(WAVE_ANGLE, baseR, ease((e - up - hold) / down));
      } else {
        w.start = -1;
        w.next = time + rand(7000, 12000);
      }
    }
    armRRot.set(armR);

    // Blink every 2.2-6 seconds using a skin-colored eyelid
    const b = blinkState.current;
    if (b.next === 0) b.next = time + rand(2200, 6000);
    if (b.start < 0 && time >= b.next) b.start = time;
    if (b.start >= 0) {
      const p = (time - b.start) / 160;
      if (p >= 1) {
        blink.set(0);
        b.start = -1;
        b.next = time + rand(2200, 6000);
      } else {
        blink.set(1 - Math.abs(2 * p - 1));
      }
    }
  });

  const armLOrigin = originIn(layers.armL, pivot.armL);
  const armROrigin = originIn(layers.armR, pivot.armR);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Animated voxel character waving hello"
      className={`relative ${className}`}
      style={{ aspectRatio: `${aspect[0]} / ${aspect[1]}` }}
    >
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ y: bobY, rotate: sway, scaleY: breathe, originX: 0.5, originY: 1 }}
      >
        {/* eslint-disable @next/next/no-img-element */}
        <img
          src="/voxel/voxel-body.webp"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none select-none"
          style={layerStyle(layers.body)}
        />

        <motion.div
          className="will-change-transform"
          style={{
            ...layerStyle(layers.armL),
            rotate: armLRot,
            originX: armLOrigin.x,
            originY: armLOrigin.y,
          }}
        >
          <img
            src="/voxel/voxel-armL.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none block h-full w-full select-none"
          />
        </motion.div>

        <motion.div
          className="will-change-transform"
          style={{
            ...layerStyle(layers.armR),
            rotate: armRRot,
            originX: armROrigin.x,
            originY: armROrigin.y,
          }}
        >
          <img
            src="/voxel/voxel-armR.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none block h-full w-full select-none"
          />
        </motion.div>

        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{
            rotate: headRot,
            y: headY,
            originX: pivot.head[0] / 100,
            originY: pivot.head[1] / 100,
          }}
        >
          <img
            src="/voxel/voxel-head.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none select-none"
            style={layerStyle(layers.head)}
          />
          {eyes.map((eye, i) => (
            <div
              key={i}
              className="overflow-hidden"
              style={{
                position: "absolute",
                left: `${eye.left}%`,
                top: `${eye.top}%`,
                width: `${eye.width}%`,
                height: `${eye.height}%`,
              }}
            >
              <motion.div
                className="absolute"
                style={{
                  left: "27%",
                  top: "27%",
                  width: "46%",
                  height: "46%",
                  backgroundColor: "#0b0b0d",
                  x: pupilX,
                  y: pupilY,
                }}
              >
                <span
                  className="absolute bg-white"
                  style={{ top: "14%", right: "14%", width: "24%", height: "24%" }}
                />
              </motion.div>
              <motion.div
                className="absolute inset-0"
                style={{ backgroundColor: SKIN, scaleY: blink, originY: 0 }}
              />
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
