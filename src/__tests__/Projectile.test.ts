
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Projectile } from '../objects/Projectile';
import { ProjectileType } from '../objects/ProjectileTypes';
import { FXManager } from '../logic/FXManager';

// 1. Mock Phaser module
vi.mock('phaser', () => {
    class Scene {
        add: any;
        input: any;
        data: any;
        scale: any;
        textures: any;
        make: any;
        constructor() {
            this.add = {
                existing: vi.fn(),
                sprite: vi.fn(() => ({
                    setTint: vi.fn().mockReturnThis(),
                    setRotation: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    destroy: vi.fn().mockReturnThis(),
                    setVisible: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    width: 10,
                    height: 10,
                    on: vi.fn(),
                    emit: vi.fn()
                }))
            };
            this.textures = { exists: vi.fn().mockReturnValue(true) };
        }
    }
    
    return {
        default: {
            Scene,
            GameObjects: { 
                Sprite: class {
                    scene: any;
                    constructor(scene: any, x: number, y: number, texture: string) {
                        this.scene = scene;
                        scene.add.existing(this);
                    }
                    setTexture = vi.fn();
                    setPosition = vi.fn();
                    setRotation = vi.fn();
                    setTint = vi.fn();
                    destroy = vi.fn();
                    x = 0;
                    y = 0;
                }
            },
            Math: {
                Distance: {
                    Between: vi.fn((x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)))
                }
            }
        },
        Scene
    };
});

// 2. Mock RapierManager
const mockWorld = {
    createRigidBody: vi.fn(() => ({
            translation: vi.fn(() => ({ x: 0, y: 0 })),
            linvel: vi.fn(() => ({ x: 0, y: 0 })),
            rotation: vi.fn(() => 0),
            isValid: vi.fn().mockReturnValue(true),
            mass: vi.fn().mockReturnValue(1),
            applyImpulse: vi.fn(),
            addForce: vi.fn()
    })),
    createCollider: vi.fn(),
    removeRigidBody: vi.fn(),
    removeCollider: vi.fn()
};

vi.mock('../physics/RapierManager', () => ({
    RapierManager: {
        getInstance: vi.fn(() => ({
            world: mockWorld,
            init: vi.fn()
        }))
    }
}));

// 3. Mock FXManager
const mockFXInstance = {
    createExplosion: vi.fn(),
    createThrustEffect: vi.fn()
};

vi.mock('../logic/FXManager', () => ({
    FXManager: {
        getInstance: vi.fn(() => mockFXInstance),
        init: vi.fn()
    }
}));

// 4. Mock Rapier Compat
vi.mock('@dimforge/rapier2d-compat', () => ({
    RigidBodyDesc: {
        dynamic: vi.fn(() => ({
            setTranslation: vi.fn().mockReturnThis(),
            setLinvel: vi.fn().mockReturnThis(),
            setCcdEnabled: vi.fn().mockReturnThis()
        }))
    },
    ColliderDesc: {
        ball: vi.fn(() => ({
            setRestitution: vi.fn().mockReturnThis(),
            setFriction: vi.fn().mockReturnThis(),
            setDensity: vi.fn().mockReturnThis(),
            setActiveEvents: vi.fn().mockReturnThis(),
            setCollisionGroups: vi.fn().mockReturnThis()
        }))
    },
    ActiveEvents: { COLLISION_EVENTS: 1 },
    default: {
        RigidBodyDesc: {
            dynamic: vi.fn(() => ({
                setTranslation: vi.fn().mockReturnThis(),
                setLinvel: vi.fn().mockReturnThis(),
                setCcdEnabled: vi.fn().mockReturnThis()
            }))
        },
        ColliderDesc: {
            ball: vi.fn(() => ({
                setRestitution: vi.fn().mockReturnThis(),
                setFriction: vi.fn().mockReturnThis(),
                setDensity: vi.fn().mockReturnThis(),
                setActiveEvents: vi.fn().mockReturnThis(),
                setCollisionGroups: vi.fn().mockReturnThis()
            }))
        },
        ActiveEvents: { COLLISION_EVENTS: 1 }
    }
}));

// Mock PhysicsGroups
vi.mock('../physics/PhysicsGroups', () => ({
    INTERACTION_PROJECTILE: 0x0001
}));

describe('Projectile Logic', () => {
    let scene: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Setup simple scene mock with removeProjectile
        const SceneClass = (await import('phaser')).default.Scene;
        scene = new SceneClass();
        scene.removeProjectile = vi.fn();
    });

    it('Defender should intercept enemy projectiles', async () => {
        // 1. Create Defender
        const defender = new Projectile(scene, 100, 100, 0, 0, undefined, ProjectileType.DEFENDER, 'TeamA');
        
        // Mock body setup for defender
        const defenderBody = (defender as any).bodyId;
        defenderBody.translation = vi.fn().mockReturnValue({ x: 100, y: 100 });
        
        // 2. Create Enemy
        const enemy = new Projectile(scene, 120, 100, 0, 0, undefined, ProjectileType.BASIC, 'TeamB');
        
        // Mock body setup for enemy
        const enemyBody = (enemy as any).bodyId;
        enemyBody.translation = vi.fn().mockReturnValue({ x: 120, y: 100 }); // Distance 20, within 35 radius
        // Ensure projectile.position getter uses body translation
        vi.spyOn(enemy, 'position', 'get').mockReturnValue({ x: 120, y: 100 }); 
        
        // 3. Create Ally (Same team, should likely NOT be intercepted if we implement FF safety, or maybe yes?)
        // Implementation check: if (this.teamId && p.teamId && this.teamId === p.teamId) return false;
        // So Ally should result in NO explosion.
        const ally = new Projectile(scene, 110, 100, 0, 0, undefined, ProjectileType.BASIC, 'TeamA');
        const allyBody = (ally as any).bodyId;
        allyBody.translation = vi.fn().mockReturnValue({ x: 110, y: 100 });
        vi.spyOn(ally, 'position', 'get').mockReturnValue({ x: 110, y: 100 });

        const projectiles = [defender, enemy, ally];
        
        // Spy on methods
        const defenderDestroy = vi.spyOn(defender, 'destroy');
        const enemyDestroy = vi.spyOn(enemy, 'destroy');
        const allyDestroy = vi.spyOn(ally, 'destroy');
        
        // 4. Run update
        defender.update([], projectiles);
        
        // 5. Assertions
        
        // Wait for FX promise (dynamic import)
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const fxManager = FXManager.getInstance();
        
        // Should explode
        expect(fxManager.createExplosion).toHaveBeenCalledWith(100, 100, expect.any(Number), 35);
        
        // Enemy destroyed
        expect(enemyDestroy).toHaveBeenCalled();
        expect(scene.removeProjectile).toHaveBeenCalledWith(enemy);
        
        // Self destroyed
        expect(defenderDestroy).toHaveBeenCalled();
        expect(scene.removeProjectile).toHaveBeenCalledWith(defender);
        
        // Ally NOT destroyed
        expect(allyDestroy).not.toHaveBeenCalled();
        expect(scene.removeProjectile).not.toHaveBeenCalledWith(ally);
    });
    
    it('Defender should NOT explode if enemies are out of range', async () => {
        const defender = new Projectile(scene, 100, 100, 0, 0, undefined, ProjectileType.DEFENDER, 'TeamA');
        const defenderBody = (defender as any).bodyId;
        defenderBody.translation = vi.fn().mockReturnValue({ x: 100, y: 100 });
        
        const enemy = new Projectile(scene, 200, 200, 0, 0, undefined, ProjectileType.BASIC, 'TeamB');
        const enemyBody = (enemy as any).bodyId;
        enemyBody.translation = vi.fn().mockReturnValue({ x: 200, y: 200 });
        vi.spyOn(enemy, 'position', 'get').mockReturnValue({ x: 200, y: 200 });

        const projectiles = [defender, enemy];
        
        const defenderDestroy = vi.spyOn(defender, 'destroy');
        const enemyDestroy = vi.spyOn(enemy, 'destroy');

        defender.update([], projectiles);
        
        await new Promise(resolve => setTimeout(resolve, 0));

        const fxManager = FXManager.getInstance();
        expect(fxManager.createExplosion).not.toHaveBeenCalled();
        expect(defenderDestroy).not.toHaveBeenCalled();
        expect(enemyDestroy).not.toHaveBeenCalled();
    });
});
