import { describe, it, expect, vi } from 'vitest';
import { GravitySystem } from '../logic/GravitySystem';

// Mock Projectile
function createMockProjectile(x: number, y: number) {
    return {
        active: true,
        position: { x, y },
        applyForce: vi.fn(),
        destroy: vi.fn(),
        getMass: () => 1
    } as any;
}

// Mock Planet
function createMockPlanet(x: number, y: number, radius: number) {
    return {
        position: { x, y },
        radiusValue: radius
    } as any;
}

describe('GravitySystem', () => {
    it('should apply force towards the planet', () => {
        const projectile = createMockProjectile(0, 0);
        const planet = createMockPlanet(100, 0, 50); // Planet to the right

        GravitySystem.applyGravity([projectile], [planet]);

        expect(projectile.applyForce).toHaveBeenCalled();
        const callArgs = projectile.applyForce.mock.calls[0];
        
        // Should be positive X force, near zero Y force
        expect(callArgs[0]).toBeGreaterThan(0);
        expect(Math.abs(callArgs[1])).toBeLessThan(0.0001);
    });

    it('should scale force with mass (radius)', () => {
        // Two identical scenarios but different planet radius
        const p1 = createMockProjectile(0, 0);
        const planet1 = createMockPlanet(100, 0, 10);
        
        GravitySystem.applyGravity([p1], [planet1]);
        const force1 = p1.applyForce.mock.calls[0][0];

        const p2 = createMockProjectile(0, 0);
        const planet2 = createMockPlanet(100, 0, 50); // 5x radius
        
        GravitySystem.applyGravity([p2], [planet2]);
        const force2 = p2.applyForce.mock.calls[0][0];

        expect(force2).toBeGreaterThan(force1);
    });

    it('should scale force with distance (inverse square)', () => {
        const p1 = createMockProjectile(0, 0);
        const planet = createMockPlanet(100, 0, 50);
        
        GravitySystem.applyGravity([p1], [planet]);
        const forceNear = p1.applyForce.mock.calls[0][0];

        const p2 = createMockProjectile(-100, 0); // Distance 200
        GravitySystem.applyGravity([p2], [planet]);
        const forceFar = p2.applyForce.mock.calls[0][0];

        expect(forceNear).toBeGreaterThan(forceFar);
        // Distance 100 vs 200 (2x distance) -> force should be roughly 1/4
        // check with some tolerance
        const ratio = forceFar / forceNear;
        expect(ratio).toBeCloseTo(0.25, 1);
    });
});
