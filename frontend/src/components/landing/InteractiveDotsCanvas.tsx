"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export function InteractiveDotsCanvas({
  dotCount = 1500,
  mouseRepelRadius = 120,
  style,
  className,
}: {
  dotCount?: number;
  mouseRepelRadius?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    
    // Support high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const particles: Particle[] = [];
    const colors = ["#B4ED50", "#B4ED50", "#42B05C", "#E0F5A1"];

    // Initialize particles in a cloud-like distribution
    for (let i = 0; i < dotCount; i++) {
      // Use gaussian-like distribution to cluster dots more towards the center and sides
      const rx = (Math.random() + Math.random() + Math.random()) / 3; 
      const ry = (Math.random() + Math.random() + Math.random()) / 3;

      // Map to width/height but allow spreading beyond bounds a bit
      const x = (rx * 1.4 - 0.2) * width;
      const y = (ry * 1.4 - 0.2) * height;

      particles.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: 0,
        vy: 0,
        size: Math.random() * 2 + 1, // smaller dots
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    const handleResize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);

    let animationFrameId: number;

    const render = () => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Slowly drift base position slightly
        p.baseX += (Math.random() - 0.5) * 0.2;
        p.baseY += (Math.random() - 0.5) * 0.2;

        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Repel from mouse
        if (distance < mouseRepelRadius) {
          const force = (mouseRepelRadius - distance) / mouseRepelRadius;
          const angle = Math.atan2(dy, dx);
          
          p.vx -= Math.cos(angle) * force * 1.5;
          p.vy -= Math.sin(angle) * force * 1.5;
        }

        // Return to base position
        const returnForce = 0.05;
        p.vx += (p.baseX - p.x) * returnForce;
        p.vy += (p.baseY - p.y) * returnForce;

        // Friction
        p.vx *= 0.85;
        p.vy *= 0.85;

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle
        ctx.beginPath();
        // Give some dots a slight stroke like the minds.ai reference
        if (p.size > 2) {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = p.color;
          ctx.stroke();
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [dotCount, mouseRepelRadius]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        ...style,
      }}
      className={className}
    />
  );
}
