import { describe, it, expect, beforeAll } from 'vitest';
import { RapierManager } from '../physics/RapierManager';

describe('RapierManager', () => {
  let rapierManager: RapierManager;

  beforeAll(async () => {
    rapierManager = RapierManager.getInstance();
    await rapierManager.init();
  }, 10000); // Increase timeout for WASM init if needed

  it('should initialize the world', () => {
    expect(rapierManager.world).not.toBeNull();
    expect(rapierManager.bodyCount).toBe(0);
  });

  it('should create a valid prediction world snapshot', () => {
    const predictionWorld = rapierManager.createPredictionWorld();
    expect(predictionWorld).toBeDefined();
    // In a fresh world, snapshot body count should match
    expect(predictionWorld?.bodies.len()).toBe(0);
    
    // Cleanup to avoid memory leaks in tests
    predictionWorld?.free();
  });
});
