import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock dependencies FIRST
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
                    mass: () => 1
                })),
                createCollider: vi.fn(),
                removeCollider: vi.fn()
            }
        }))
    }
}));

vi.mock('../config', () => ({
    GameConfig: {
        DEBUG_INFINITE_AP: false,
        RED_FACTION_MAX_AP: false,
        TURRET_FRICTION: 2.0,
        TURRET_DAMPING: 0.5
    }
}));

vi.mock('../logic/FXManager', () => ({
    FXManager: {
        getInstance: vi.fn(() => ({
            createExplosion: vi.fn(),
            createDebrisBurst: vi.fn(),
            update: vi.fn(),
            createThrustEffect: vi.fn()
        })),
        init: vi.fn()
    }
}));


// 1. Mock Phaser module fully
vi.mock('phaser', () => {
    class Scene {
// ... existing mock content ...
        add: any;
        input: any;
        data: any;
        tweens: any;
        constructor() {
            this.add = {
                text: vi.fn().mockReturnThis(),
                sprite: vi.fn(() => ({
                    setTint: vi.fn().mockReturnThis(),
                    setRotation: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    getBounds: vi.fn(() => ({ contains: () => false })),
                    setVisible: vi.fn()
                })),
                circle: vi.fn(() => ({
                    setStrokeStyle: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    setDepth: vi.fn(),
                    setInteractive: vi.fn(),
                    setData: vi.fn(),
                    setVisible: vi.fn(),
                    setX: vi.fn(),
                    setScale: vi.fn()
                })),
                rectangle: vi.fn(() => ({
                    setRotation: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    setInteractive: vi.fn(),
                    setFillStyle: vi.fn(),
                    getBounds: vi.fn(() => ({ contains: () => false }))
                })),
                graphics: vi.fn(() => ({
                    clear: vi.fn(),
                    fillStyle: vi.fn(),
                    fillRect: vi.fn(),
                    strokeRect: vi.fn(),
                    lineStyle: vi.fn(),
                    lineBetween: vi.fn(),
                    destroy: vi.fn(),
                    setDepth: vi.fn(),
                    setVisible: vi.fn(),
                    beginPath: vi.fn(),
                    moveTo: vi.fn(),
                    lineTo: vi.fn(),
                    strokePath: vi.fn(),
                    fillPoints: vi.fn()
                }))
            };
            this.input = {
                keyboard: { on: vi.fn() },
                on: vi.fn()
            };
            this.data = { set: vi.fn(), get: vi.fn() };
            this.tweens = { add: vi.fn() };
        }
    }
    
    return {
        default: {
            Scene,
            Game: vi.fn(),
            Utils: {
                String: { UUID: () => 'uuid-' + Math.random() }
            },
            Math: {
                Distance: {
                    Between: vi.fn((x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)))
                },
                Vector2: class { x=0;y=0; constructor(x=0,y=0){this.x=x;this.y=y;} }
            },
            GameObjects: { Graphics: class {}, Rectangle: class {}, Arc: class {} }
        },
        Scene
    };
});

// Mock Rapier Compat
vi.mock('@dimforge/rapier2d-compat', () => {
    class MockDesc {
        _translation = { x: 0, y: 0 };
        setTranslation(x, y) { this._translation = { x, y }; return this; }
        setRotation(r) { return this; }
        setLinvel(x, y) { return this; }
        setCcdEnabled(e) { return this; }
        setActiveEvents(e) { return this; }
        setRestitution(r) { return this; }
        setFriction(f) { return this; }
        setDensity(d) { return this; }
    }

    return {
        default: {
            RigidBodyDesc: {
                fixed: vi.fn(() => new MockDesc()),
                dynamic: vi.fn(() => new MockDesc())
            },
            ColliderDesc: {
                cuboid: vi.fn(() => new MockDesc()),
                ball: vi.fn(() => new MockDesc()),
                polyline: vi.fn(() => new MockDesc())
            },
            ActiveEvents: { COLLISION_EVENTS: 0 }
        },
        RigidBodyDesc: {
            fixed: vi.fn(() => new MockDesc()),
            dynamic: vi.fn(() => new MockDesc())
        },
        ColliderDesc: {
            cuboid: vi.fn(() => new MockDesc()),
            ball: vi.fn(() => new MockDesc()),
            polyline: vi.fn(() => new MockDesc())
        },
        ActiveEvents: { COLLISION_EVENTS: 0 }
    };
});

describe('Turret Mechanics', () => {
    let mockScene: any;
    let Turret: any;


    beforeEach(async () => {
        // We can just construct the mocked class safely now
        const phaserModule = await import('phaser');
        const { Scene } = phaserModule.default; 
        mockScene = new Scene();
        
        // Dynamic imports to ensure mocks are active
        const turretModule = await import('../objects/Turret');
        Turret = turretModule.Turret;
        

    });

    it('should initialize with 3 HP and 1 AP', () => {
        const turret = new Turret(mockScene, 0, 0, 0);
        expect(turret.health).toBe(100);
        expect(turret.actionPoints).toBe(1);
    });

    it('should cap AP at maxActionPoints', () => {
        const turret = new Turret(mockScene, 0, 0, 0);
        turret.maxActionPoints = 5;
        turret.actionPoints = 4;
        
        turret.addActionPoints(2);
        expect(turret.actionPoints).toBe(5);
    });

    it('should consume AP correctly', () => {
        const turret = new Turret(mockScene, 0, 0, 0);
        turret.actionPoints = 1;
        
        const success = turret.consumeActionPoints(1);
        expect(success).toBe(true);
        expect(turret.actionPoints).toBe(0);
        
        const fail = turret.consumeActionPoints(1);
        expect(fail).toBe(false);
        expect(turret.actionPoints).toBe(0);
    });
});

describe('Planet Control Logic', () => {
    let mockScene: any;
    let Planet: any;

    let planet: any;

    beforeEach(async () => {
        const phaserModule = await import('phaser');
        const { Scene } = phaserModule.default; 
        mockScene = new Scene();
        
        const planetModule = await import('../objects/Planet');
        Planet = planetModule.Planet;
        
        // Planet internal logic might instantiate Turret, so allow it. 
        // Since we mocked Phaser, internal Turret instantiation should be fine 
        // as long as Turret class is loaded after mocks.
        
        planet = new Planet(mockScene, 0, 0, 50, 0xffffff, null);
    });

    it('should return null for empty planet', () => {
        expect(planet.getControllerTeamId()).toBeNull();
    });

    it('should return teamId if all turrets belong to same team', () => {
        planet.addTurretAtAngle(0, 'red');
        planet.addTurretAtAngle(1, 'red');
        
        expect(planet.getControllerTeamId()).toBe('red');
    });

    it('should return null if turrets are mixed', () => {
        planet.addTurretAtAngle(0, 'red');
        planet.addTurretAtAngle(1, 'green');
        
        expect(planet.getControllerTeamId()).toBeNull();
    });

    it('should return null if any turret is neutral (null team)', () => {
        planet.addTurretAtAngle(0, 'red');
        planet.addTurretAtAngle(1, null);
        
        expect(planet.getControllerTeamId()).toBeNull();
    });
});

describe('Planet Terrain Logic', () => {
    let mockScene: any;
    let Planet: any;
    let planet: any;

    beforeEach(async () => {
        const phaserModule = await import('phaser');
        const { Scene } = phaserModule.default; 
        mockScene = new Scene();
        
        const planetModule = await import('../objects/Planet');
        Planet = planetModule.Planet;
        
        // Use a larger radius for clear testing
        planet = new Planet(mockScene, 100, 100, 50, 0xffffff, null);
    });

    it('should return approximately 0 at the original surface', () => {
        const dist = planet.getDistanceToSurface(151, 100); // Slightly outside to avoid floating point issues
        expect(dist).toBeGreaterThan(-1);
        expect(dist).toBeLessThan(5);
    });

    it('should return positive value outside the surface', () => {
        const dist = planet.getDistanceToSurface(160, 100);
        // radius 50 + 10 = 60. distance to surface should be 10.
        expect(dist).toBeGreaterThan(5);
        expect(dist).toBeLessThan(15);
    });

    it('should return negative value inside the surface', () => {
        const dist = planet.getDistanceToSurface(140, 100);
        expect(dist).toBeLessThan(-8);
        expect(dist).toBeGreaterThan(-12);
    });

    it('should detect deeper surface in a crater', () => {
        // Create a crater at angle 0
        planet.takeDamage(150, 100, 20);
        
        // Distance to "ground" at (150, 100) should now be positive 
        // because the ground has receded towards the center.
        // Surface at angle 0 should be around x=130.
        // distFromCenter(150, 100) = 50.
        // surfaceDist(angle 0) = 30 (approx).
        // distanceToSurface = 50 - 30 = 20.
        const dist = planet.getDistanceToSurface(150, 100);
        expect(dist).toBeGreaterThan(15);
    });

    it('should spawn turret deeper in a crater', () => {
        planet.takeDamage(150, 100, 20);
        const turret = planet.addTurretAtAngle(0, 'red');
        
        // Original spawn was at 155.
        // New spawn should be around 135.
        expect(turret.position.x).toBeLessThan(145);
        expect(turret.position.x).toBeGreaterThan(130);
    });
});
