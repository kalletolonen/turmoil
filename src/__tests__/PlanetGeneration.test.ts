
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Phaser before importing anything else
vi.mock('phaser', () => {
    return {
        default: {
            Scene: class MockScene {
                add = {
                    graphics: () => ({
                        clear: vi.fn(),
                        fillStyle: vi.fn(),
                        fillPoints: vi.fn(),
                        destroy: vi.fn()
                    })
                };
            },
            Utils: {
                String: {
                    UUID: () => 'mock-uuid'
                }
            },
            GameObjects: {
                Graphics: class {}
            }
        }
    };
});

// Import Planet after mocking
import { Planet } from '../objects/Planet';
import Phaser from 'phaser';

vi.mock('../physics/RapierManager', () => {
    return {
        RapierManager: {
            getInstance: () => ({
                world: {
                    createRigidBody: () => ({
                        numColliders: () => 0,
                        collider: () => ({}),
                        removeCollider: () => {},
                        createCollider: () => {},
                        translation: () => ({ x: 0, y: 0 })
                    }),
                    createCollider: () => {},
                    removeCollider: () => {}
                }
            })
        }
    };
});

vi.mock('../objects/Turret', () => {
    return {
        Turret: class {}
    };
});

vi.mock('../logic/FXManager', () => {
    return {
        FXManager: {
            getInstance: () => ({
                createDebrisBurst: vi.fn()
            })
        }
    };
});

describe('Planet Generation', () => {
    let mockScene: any;

    beforeEach(() => {
        mockScene = new Phaser.Scene();
    });

    it('should generate identical terrain for the same seed', () => {
        const seed = 12345;
        const planet1 = new Planet(mockScene, 0, 0, 100, 0xffffff, null, seed);
        const planet2 = new Planet(mockScene, 0, 0, 100, 0xffffff, null, seed);

        // Check if regions are identical
        // regions is private, so we cast to any
        const p1Regions = (planet1 as any).regions;
        const p2Regions = (planet2 as any).regions;

        expect(p1Regions).toEqual(p2Regions);
    });

    it('should generate different terrain for different seeds', () => {
        const planet1 = new Planet(mockScene, 0, 0, 100, 0xffffff, null, 12345);
        const planet2 = new Planet(mockScene, 0, 0, 100, 0xffffff, null, 67890);

        const p1Regions = (planet1 as any).regions;
        const p2Regions = (planet2 as any).regions;

        // Heavily unlikely to be exactly same
        expect(p1Regions).not.toEqual(p2Regions);
    });
});
