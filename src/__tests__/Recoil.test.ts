import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainScene } from '../scenes/MainScene';
import { Turret } from '../objects/Turret';
import { Projectile } from '../objects/Projectile';
import { ProjectileType } from '../objects/ProjectileTypes';

// Mock Dependencies
vi.mock('../physics/RapierManager', () => ({
    RapierManager: {
        getInstance: vi.fn(() => ({
            init: vi.fn(),
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
                    setAngvel: vi.fn(),
                    linvel: () => ({ x: 0, y: 0 })
                })),
                createCollider: vi.fn(),
                removeCollider: vi.fn(),
                removeRigidBody: vi.fn(),
                step: vi.fn(),
                getAllBodyData: vi.fn(() => [])
            }
        }))
    }
}));

vi.mock('../logic/FXManager', () => ({
    FXManager: {
        getInstance: vi.fn(() => ({
            createExplosion: vi.fn(),
            showFloatingText: vi.fn(),
            update: vi.fn()
        })),
        init: vi.fn()
    }
}));

vi.mock('phaser', () => {
    class Scene {
        add: any;
        data: any;
        input: any;
        textures: any;
        make: any;
        sound: any;
        tweens: any;
        
        constructor() {
            this.add = {
                graphics: vi.fn(() => ({
                    clear: vi.fn(),
                    fillStyle: vi.fn(),
                    fillRect: vi.fn(),
                    destroy: vi.fn(),
                    setDepth: vi.fn(),
                    destroy: vi.fn(),
                    setDepth: vi.fn(),
                    setScrollFactor: vi.fn(),
                    setText: vi.fn(),
                    lineStyle: vi.fn(),
                    strokeRect: vi.fn(),
                    beginPath: vi.fn(),
                    moveTo: vi.fn(),
                    lineTo: vi.fn(),
                    strokePath: vi.fn(),
                    setVisible: vi.fn()
                })),
                image: vi.fn(() => ({
                    setTint: vi.fn(),
                    setDepth: vi.fn(),
                    setScale: vi.fn(),
                    destroy: vi.fn()
                })),
                sprite: vi.fn(() => ({
                    setTint: vi.fn(),
                    setRotation: vi.fn(),
                    setScale: vi.fn(),
                    setInteractive: vi.fn(),
                    destroy: vi.fn(),
                    setPosition: vi.fn(),
                    getBounds: vi.fn()
                })),
                text: vi.fn(() => ({
                    setScrollFactor: vi.fn(),
                    setName: vi.fn(),
                    setDepth: vi.fn(),
                    destroy: vi.fn(),
                    setText: vi.fn()
                })),
                existing: vi.fn()
            };
            this.data = {
                set: vi.fn(),
                get: vi.fn(),
            };
            this.input = {
                on: vi.fn()
            };
            this.textures = {
                exists: vi.fn(() => true),
                createCanvas: vi.fn(),
            };
            this.make = {
                graphics: vi.fn(() => ({
                    fillStyle: vi.fn(),
                    fillCircle: vi.fn(),
                    generateTexture: vi.fn(),
                    destroy: vi.fn(),
                    lineStyle: vi.fn(),
                    beginPath: vi.fn(),
                    moveTo: vi.fn(),
                    lineTo: vi.fn(),
                    closePath: vi.fn(),
                    fillPath: vi.fn(),
                    strokePath: vi.fn(),
                    fillRect: vi.fn()
                }))
            };
            this.sound = {};
            this.tweens = {
                add: vi.fn()
            };
        }
    }
    return {
        default: {
            Scene,
            Utils: { String: { UUID: () => 'uuid-123' } },
            Math: { 
                Distance: { Between: () => 100 },
                Angle: { Between: () => 0 }
            },
            GameObjects: { 
                Graphics: class {}, 
                Sprite: class {
                    setTexture = vi.fn();
                    setTint = vi.fn();
                    setRotation = vi.fn();
                    setScale = vi.fn();
                    setInteractive = vi.fn();
                    destroy = vi.fn();
                    setPosition = vi.fn();
                    x = 0;
                    y = 0;
                } 
            }
        }
    };
});

// Mock other singletons/classes
vi.mock('../objects/Planet', () => ({
    Planet: class {
        turretsList = [];
        position = { x: 0, y: 0 };
        getControllerTeamId() { return null; }
    }
}));

describe('Recoil Mechanics', () => {
    let mainScene: MainScene;
    let turret: Turret;

    beforeEach(async () => {
        mainScene = new MainScene();
        // Manually trigger create? Or just setup what we need.
        // We need 'planets' array.
        mainScene.planets = [];
        
        // Setup a mock turret
        turret = new Turret(mainScene as any, 100, 100, 0);
        // Inject mock body spy
        const bodySpy = {
            setBodyType: vi.fn(),
            wakeUp: vi.fn(),
            applyImpulse: vi.fn(),
            translation: () => ({ x: 100, y: 100 }),
            rotation: () => 0,
            mass: () => 100
        };
        (turret as any).body = bodySpy;
        
        // Mock planet for the turret
        // Mock planet for the turret
        // We already mocked Planet module, so we can instantiate it
        const PlanetClass = (await import('../objects/Planet')).Planet;
        const planet = new PlanetClass(mainScene as any, 0, 0, 100, 0xff0000);
        planet.turretsList = [turret];
        mainScene.planets.push(planet);
    });

    it('should NOT apply recoil if force is below resistance threshold', () => {
        // Weak shot: Speed 15, Mass 1. Magnitude = 15 * 1 * 10 = 150.
        // Resistance is 200. 150 < 200 -> No effect.
        
        turret.setArmed(true, { x: 15, y: 0 }); // Medium Aim
        turret.projectileType = ProjectileType.BASIC;
        turret.teamId = 'red';
        
        const impulseSpy = (turret as any).body.applyImpulse;
        const setFallingSpy = vi.spyOn(turret, 'setFalling');
        
        mainScene.fireProjectiles();
        
        expect(setFallingSpy).not.toHaveBeenCalled();
        expect(impulseSpy).not.toHaveBeenCalled();
    });

    it('should NOT apply recoil if force is roughly standard strong shot (300)', () => {
        // Strong shot: Speed 30, Mass 1. Magnitude = 300.
        // Resistance is 2000. 300 < 2000 -> No effect.
        
        turret.setArmed(true, { x: 30, y: 0 }); 
        turret.projectileType = ProjectileType.BASIC;
        turret.teamId = 'red';
        
        const impulseSpy = (turret as any).body.applyImpulse;
        const setFallingSpy = vi.spyOn(turret, 'setFalling');
        
        mainScene.fireProjectiles();
        
        expect(setFallingSpy).not.toHaveBeenCalled();
        expect(impulseSpy).not.toHaveBeenCalled();
    });

    it('should apply REDUCED recoil if force is Extreme (3000)', () => {
        // God Mode shot: Speed 300, Mass 1. Magnitude = 300 * 1 * 10 = 3000.
        // Resistance is 2000. Effective = 3000 - 2000 = 1000.
        
        turret.setArmed(true, { x: 300, y: 0 });
    });

    it('should apply FULL recoil if turret is already airborne (Zero Resistance)', () => {
        // Weak shot: Speed 15, Mass 1. Magnitude = 15 * 1 * 10 = 150.
        // On ground: 150 < 2000 -> Ignored.
        // In air: Resistance 0. Effective = 150.
        
        turret.setFalling(true); // Manually set to airborne
        turret.setArmed(true, { x: 15, y: 0 }); 
        turret.projectileType = ProjectileType.BASIC;
        turret.teamId = 'red';
        
        const impulseSpy = (turret as any).body.applyImpulse;
        
        mainScene.fireProjectiles();
        
        expect(impulseSpy).toHaveBeenCalled();
        const args = impulseSpy.mock.calls[0][0];
        
        // Expected X: -150 (Full magnitude)
        expect(args.x).toBeCloseTo(-150); 
    });
});
