
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollisionManager } from '../logic/CollisionManager';
import { Projectile } from '../objects/Projectile';
import { ProjectileType } from '../objects/ProjectileTypes';
import { Planet } from '../objects/Planet';

// Mock Phaser module
vi.mock('phaser', () => {
    return {
        default: {
            Math: {
                Distance: {
                    Between: vi.fn((x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)))
                }
            },
            Scene: class {}
        }
    };
});

// Mock dependencies
const mockScene = {
    add: { existing: vi.fn() }
};

const mockCombatManager = {
    createExplosion: vi.fn(),
    applyRadialDamage: vi.fn()
};

const mockTeamManager = {
    getTeam: vi.fn()
};

const mockRapierManager = {
    drainCollisionEvents: vi.fn(),
    world: {
        getCollider: vi.fn()
    },
    getInstance: vi.fn() // Static method mocked below
};

// Mock RapierManager static getInstance
vi.mock('../physics/RapierManager', () => ({
    RapierManager: {
        getInstance: vi.fn(() => mockRapierManager)
    }
}));

// Mock FXManager for explosion visuals
vi.mock('../logic/FXManager', () => ({
    FXManager: {
        getInstance: vi.fn(() => ({
            createExplosion: vi.fn()
        })),
        init: vi.fn()
    }
}));

describe('CollisionManager', () => {
    let collisionManager: CollisionManager;
    let planets: Planet[] = [];
    let removeProjectileMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        planets = [];
        collisionManager = new CollisionManager(
            mockScene as any,
            mockCombatManager as any,
            mockTeamManager as any,
            () => planets,
            removeProjectileMock
        );
    });

    it('should NOT damage planet when Defender (damage=0) hits it', () => {
        // Setup Planet
        const planet = {
            id: 'p1',
            position: { x: 100, y: 100 },
            radiusValue: 50,
            takeDamage: vi.fn(),
            userData: { parent: null } // Circular reference workaround
        } as any;
        planet.userData.parent = planet;
        planets.push(planet);

        // Setup Defender Projectile
        const defender = {
            x: 100,
            y: 50, // Impact point
            projectileType: ProjectileType.DEFENDER,
            damage: 0,
            destroy: vi.fn()
        } as any;

        // Mock Rapier Collision Event
        mockRapierManager.drainCollisionEvents.mockImplementation((callback: any) => {
            // Simulate event
            callback(1, 2, true);
        });

        // Mock Colliders/Bodies
        const colliderP = { parent: () => ({ userData: { type: 'projectile', visual: defender } }) };
        const colliderPlanet = { parent: () => ({ userData: { type: 'planet', parent: planet } }) };
        
        mockRapierManager.world.getCollider.mockImplementation((handle: number) => {
            if (handle === 1) return colliderP;
            if (handle === 2) return colliderPlanet;
            return null;
        });

        // Run Update
        collisionManager.update();

        // Assertions
        // 1. Planet takeDamage should NOT be called (damage 0)
        expect(planet.takeDamage).not.toHaveBeenCalled();

        // 2. Projectile should be destroyed
        expect(defender.destroy).toHaveBeenCalled();
        expect(removeProjectileMock).toHaveBeenCalledWith(defender);
    });

    it('should damage planet when Basic projectile (damage>0) hits it', () => {
        // Setup Planet
        const planet = {
            id: 'p1',
            position: { x: 100, y: 100 },
            radiusValue: 50,
            takeDamage: vi.fn(),
            userData: { parent: null }
        } as any;
        planet.userData.parent = planet;
        planets.push(planet);

        // Setup Basic Projectile
        const basic = {
            x: 100,
            y: 50,
            projectileType: ProjectileType.BASIC,
            damage: 30, // > 0
            destroy: vi.fn()
        } as any;

        // Mock Rapier
        mockRapierManager.drainCollisionEvents.mockImplementation((callback: any) => {
            callback(1, 2, true);
        });

        const colliderP = { parent: () => ({ userData: { type: 'projectile', visual: basic } }) };
        const colliderPlanet = { parent: () => ({ userData: { type: 'planet', parent: planet } }) };
        
        mockRapierManager.world.getCollider.mockImplementation((handle: number) => {
            if (handle === 1) return colliderP;
            if (handle === 2) return colliderPlanet;
            return null;
        });

        // Run
        collisionManager.update();

        // Assertions
        expect(planet.takeDamage).toHaveBeenCalled();
        expect(basic.destroy).toHaveBeenCalled();
    });
});
