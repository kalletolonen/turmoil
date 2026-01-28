import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
vi.mock('../physics/RapierManager', () => ({
    RapierManager: {
        getInstance: vi.fn(() => ({
            world: {
                createRigidBody: vi.fn((desc) => ({
                    userData: {},
                    translation: () => desc._translation || { x: 0, y: 0 },
                    rotation: () => 0,
                    numColliders: vi.fn(() => 0),
                    collider: vi.fn(() => ({})),
                    isValid: () => true,
                    mass: () => 1,
                    setBodyType: vi.fn(),
                    applyForce: vi.fn(),
                    applyImpulse: vi.fn(),
                    wakeUp: vi.fn(),
                    setLinvel: vi.fn(),
                    setAngvel: vi.fn()
                })),
                createCollider: vi.fn(),
                removeCollider: vi.fn(),
                removeRigidBody: vi.fn()
            }
        }))
    }
}));

vi.mock('../logic/FXManager', () => ({
    FXManager: {
        getInstance: vi.fn(() => ({
            createExplosion: vi.fn(),
            createDebrisBurst: vi.fn(),
            update: vi.fn()
        })),
        init: vi.fn()
    }
}));

vi.mock('phaser', () => {
    class Scene {
        add: any;
        constructor() {
            this.add = {
                graphics: vi.fn(() => ({
                    clear: vi.fn(),
                    fillStyle: vi.fn(),
                    fillRect: vi.fn(),
                    strokeRect: vi.fn(),
                    lineStyle: vi.fn(),
                    destroy: vi.fn(),
                    setVisible: vi.fn(),
                    fillPoints: vi.fn(),
                    setDepth: vi.fn(),
                    beginPath: vi.fn(),
                    moveTo: vi.fn(),
                    lineTo: vi.fn(),
                    strokePath: vi.fn()
                })),
                sprite: vi.fn(() => ({
                    setTint: vi.fn(),
                    setRotation: vi.fn(),
                    setScale: vi.fn(),
                    setInteractive: vi.fn(),
                    destroy: vi.fn(),
                    getBounds: vi.fn(() => ({ contains: () => false })),
                    setVisible: vi.fn()
                }))
            };
        }
    }
    return {
        default: {
            Scene,
            Utils: { String: { UUID: () => 'uuid-' + Math.random() } },
            Math: { Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2-x1, y2-y1) } },
            GameObjects: { Graphics: class {}, Sprite: class {} }
        }
    };
});

vi.mock('@dimforge/rapier2d-compat', () => {
    class MockDesc {
        _translation = { x: 0, y: 0 };
        setTranslation(x, y) { this._translation = { x, y }; return this; }
        setRotation(r) { return this; }
        setActiveEvents(e) { return this; }
    }
    return {
        default: {
            RigidBodyDesc: {
                fixed: vi.fn(() => new MockDesc()),
                dynamic: vi.fn(() => new MockDesc())
            },
            ColliderDesc: {
                cuboid: vi.fn(() => new MockDesc()),
                polyline: vi.fn(() => new MockDesc())
            },
            ActiveEvents: { COLLISION_EVENTS: 0 },
            RigidBodyType: { Dynamic: 0, Fixed: 1 }
        }
    };
});

describe('Falling Turrets Mechanics', () => {
    let Planet: any;
    let Turret: any;
    let mockScene: any;

    beforeEach(async () => {
        const planetModule = await import('../objects/Planet');
        Planet = planetModule.Planet;
        const turretModule = await import('../objects/Turret');
        Turret = turretModule.Turret;
        const phaserModule = await import('phaser');
        mockScene = new phaserModule.default.Scene();
    });

    it('should detect when a turret is undermined', () => {
        // Setup Planet
        const planet = new Planet(mockScene, 100, 100, 50, 0xffffff, null);
        
        // Add Turret at top (angle -PI/2 or similar)
        // At 100, 100 with radius 50. Top is 100, 50.
        // Angle -PI/2.
        const turret = planet.addTurretAtAngle(-Math.PI/2, 'red');
        
        // Verify initial state
        // expect(turret.isFalling).toBe(false); // Does not exist yet

        // Destroy ground under turret
        // Turret is at (100, 45) roughly (radius + 5 spacing). 
        // We damage the planet at (100, 50) with radius 20.
        planet.takeDamage(100, 50, 20);
        
        // This logic is currently inside Planet.takeDamage or checking loop
        // We need to verify if the turret's "isFalling" flag gets set or if we can simulate the check
        
        // Manually simulate the check that will go into Planet.takeDamage
        // const dist = planet.getDistanceToSurface(turret.position.x, turret.position.y);
        // expect(dist).toBeGreaterThan(5);
        
        // Ideally, Planet.takeDamage should trigger the check.
        // For now, let's just assert that the distance logic works for detection
        const dist = planet.getDistanceToSurface(turret.position.x, turret.position.y);
        expect(dist).toBeGreaterThan(10); // Gap should be significant
    });

    it('should switch physics body when falling', () => {
        const turret = new Turret(mockScene, 0, 0, 0);
        // Mock body
        const bodySpy = {
            setBodyType: vi.fn(),
            wakeUp: vi.fn(),
            setLinvel: vi.fn(),
            setAngvel: vi.fn(),
            applyImpulse: vi.fn(),
            translation: () => ({ x: 0, y: 0 }),
            rotation: () => 0
        };
        (turret as any).body = bodySpy; // Inject spy

        turret.setFalling(true);
        expect(turret.isFalling).toBe(true);
        // We mocked RAPIER in the test file top level, but accessing the enum might be tricky if not exported perfectly.
        // We know we called setBodyType(dynamic, true).
        expect(bodySpy.setBodyType).toHaveBeenCalledWith(0, true); // Dynamic is 0 in our mock
        expect(bodySpy.wakeUp).toHaveBeenCalled();

        turret.setFalling(false);
        expect(turret.isFalling).toBe(false);
        expect(bodySpy.setBodyType).toHaveBeenCalledWith(1, true); // Fixed is 1 in our mock
        turret.setFalling(false);
        expect(turret.isFalling).toBe(false);
        expect(bodySpy.setBodyType).toHaveBeenCalledWith(1, true); // Fixed is 1 in our mock
    });

    it('should detect when a turret is over a complete hole (ghost terrain bug)', () => {
        // Reproduce the issue: If raycast hits nothing, it defaults to radius, effectively saying "terrain is here"
        const planet = new Planet(mockScene, 100, 100, 50, 0xffffff, null);
        
        // Mock regions to be empty or effectively a C shape away from the turret
        // Turret at angle 0 (Right).
        const turret = planet.addTurretAtAngle(0, 'red'); // x ~ 155, y ~ 100
        
        // Manually destroy the region logic to simulate a "hole" at angle 0
        // We can't easily manipulate private `regions` without accessing it via ANY or using takeDamage to carve it precisely.
        // Let's use takeDamage to carve a huge hole at angle 0.
        // Destroy the center to ensure NO intersection at angle 0.
        planet.takeDamage(100, 100, 60); // Destroy entire planet basically
        
        // Raycast at angle 0 should now hit NOTHING.
        // If it hits nothing, getSurfaceDistanceAtAngle returns `radius` (50).
        // distFromCenter is ~55.
        // dist = 55 - 50 = 5.
        // dist > 5 is FALSE. (5 is not > 5).
        // So it won't fall.
        
        // We expect correct behavior: surface should be 0 (or undefined/infinity logic).
        // If we interpret lack of surface as "surface is at origin (0)", then:
        // dist = 55 - 0 = 55.
        // 55 > 5 is TRUE.
        
        const dist = planet.getDistanceToSurface(turret.position.x, turret.position.y);
        console.log('DEBUG: dist to surface (destroyed)', dist);
        
        // This EXPECTATION will FAIL if the bug exists (it will be 5).
        expect(dist).toBeGreaterThan(20);
    });
});
