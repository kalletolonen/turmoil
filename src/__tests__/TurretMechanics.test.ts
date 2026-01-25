import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock dependencies FIRST
vi.mock('../physics/RapierManager', () => ({
    RapierManager: {
        getInstance: vi.fn(() => ({
            world: {
                createRigidBody: vi.fn(() => ({
                    userData: {},
                    translation: () => ({ x: 0, y: 0 }),
                    rotation: () => 0
                })),
                createCollider: vi.fn()
            }
        }))
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
                    strokePath: vi.fn()
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
    const rigidBodyDescMock = {
        setTranslation: vi.fn().mockReturnThis(),
        setRotation: vi.fn().mockReturnThis()
    };
    return {
        default: {
            RigidBodyDesc: {
                fixed: vi.fn(() => rigidBodyDescMock)
            },
            ColliderDesc: {
                cuboid: vi.fn(() => ({ setActiveEvents: vi.fn() })),
                ball: vi.fn()
            },
            ActiveEvents: { COLLISION_EVENTS: 0 }
        },
        RigidBodyDesc: {
            fixed: vi.fn(() => rigidBodyDescMock)
        },
        ColliderDesc: {
            cuboid: vi.fn(() => ({ setActiveEvents: vi.fn() })),
            ball: vi.fn()
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
        expect(turret.health).toBe(3);
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
