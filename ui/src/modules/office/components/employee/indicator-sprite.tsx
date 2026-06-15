"use client";

/**
 * Employee indicator sprites.
 *
 * Ownership: tiny in-world employee state icons for both 3D and 2D character renderers.
 * Inputs: semantic icon kind, color, opacity, and world position.
 * Outputs: camera-facing pixel-art Three.js sprite.
 * Side effects: creates and disposes local CanvasTexture/SpriteMaterial instances.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three";

export type EmployeeIndicatorIcon = "diamond" | "heart";

const CANVAS_SIZE = 64;
const PIXEL_SIZE = 4;

function drawPixel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  context.fillStyle = color;
  context.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

function drawRow(
  context: CanvasRenderingContext2D,
  y: number,
  startX: number,
  endX: number,
  color: string,
): void {
  for (let x = startX; x <= endX; x += 1) {
    drawPixel(context, x, y, color);
  }
}

function drawPixelDiamond(context: CanvasRenderingContext2D, color: string): void {
  const outlineRows = [
    [2, 7, 8],
    [3, 6, 9],
    [4, 5, 10],
    [5, 5, 10],
    [6, 4, 11],
    [7, 4, 11],
    [8, 5, 10],
    [9, 5, 10],
    [10, 6, 9],
    [11, 7, 8],
    [12, 7, 8],
  ] as const;
  const fillRows = [
    [3, 7, 8],
    [4, 6, 9],
    [5, 6, 9],
    [6, 5, 10],
    [7, 5, 10],
    [8, 6, 9],
    [9, 6, 9],
    [10, 7, 8],
    [11, 7, 8],
  ] as const;

  for (const [y, startX, endX] of outlineRows) drawRow(context, y, startX, endX, "#0f172a");
  for (const [y, startX, endX] of fillRows) drawRow(context, y, startX, endX, color);
}

function drawPixelHeart(context: CanvasRenderingContext2D, color: string): void {
  const outline = [
    "001110011100",
    "011111111110",
    "111111111111",
    "111111111111",
    "011111111110",
    "001111111100",
    "000111111000",
    "000011110000",
    "000001100000",
  ];
  const fill = [
    "000100001000",
    "001111111100",
    "011111111110",
    "011111111110",
    "001111111100",
    "000111111000",
    "000011110000",
    "000001100000",
    "000000000000",
  ];
  const offsetX = 2;
  const offsetY = 3;

  outline.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "1") drawPixel(context, x + offsetX, y + offsetY, "#0f172a");
    });
  });
  fill.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "1") drawPixel(context, x + offsetX, y + offsetY, color);
    });
  });
}

function buildEmployeeIndicatorTexture(icon: EmployeeIndicatorIcon, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("employee_indicator_canvas_unavailable");

  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  context.imageSmoothingEnabled = false;
  if (icon === "heart") drawPixelHeart(context, color);
  else drawPixelDiamond(context, color);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export function EmployeeIndicatorSprite({
  icon,
  color,
  opacity = 1,
  position,
  scale = 0.28,
}: {
  icon: EmployeeIndicatorIcon;
  color: string;
  opacity?: number;
  position: [number, number, number];
  scale?: number;
}) {
  const texture = useMemo(() => buildEmployeeIndicatorTexture(icon, color), [color, icon]);
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    [opacity, texture],
  );

  useEffect(() => {
    material.opacity = opacity;
  }, [material, opacity]);

  useEffect(() => {
    return () => {
      material.dispose();
      texture.dispose();
    };
  }, [material, texture]);

  return <sprite material={material} position={position} scale={[scale, scale, 1]} />;
}
