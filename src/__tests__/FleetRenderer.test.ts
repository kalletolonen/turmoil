import { describe, it, expect, vi } from 'vitest';
import { FleetRenderer } from '../renderer/FleetRenderer';
import Phaser from 'phaser';

// Mock Phaser Scene and Mesh
const mockMesh = {
  clear: vi.fn(),
  addVertex: vi.fn(),
};

const mockScene = {
  textures: {
    exists: vi.fn().mockReturnValue(true),
  },
  add: {
    mesh: vi.fn().mockReturnValue(mockMesh),
  },
  make: {
      graphics: vi.fn()
  }
} as unknown as Phaser.Scene;

describe('FleetRenderer', () => {
  it('should create a mesh on initialization', () => {
    new FleetRenderer(mockScene);
    expect(mockScene.add.mesh).toHaveBeenCalled();
  });

  it('should update mesh vertices based on body count', () => {
    const renderer = new FleetRenderer(mockScene);
    const bodies = [
      { x: 100, y: 100, rotation: 0 },
      { x: 200, y: 200, rotation: Math.PI }
    ];

    renderer.update(bodies);

    expect(mockMesh.clear).toHaveBeenCalled();
    // 2 ships * 2 triangles * 3 vertices = 12 vertices calls using addVertex
    expect(mockMesh.addVertex).toHaveBeenCalledTimes(12);
  });
});
