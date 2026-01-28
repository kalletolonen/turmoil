import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock Phaser module fully BEFORE importing MainScene
vi.mock('phaser', () => {
    // Mock for Phaser.Scene class
    class Scene {
        add: any;
        input: any;
        data: any;
        scale: any;
        textures: any;
        make: any;
        constructor() {
            this.scale = { width: 800, height: 600 };
            this.textures = {
                exists: vi.fn().mockReturnValue(false),
                generateTexture: vi.fn()
            };
            this.make = {
                graphics: vi.fn(() => ({
                    clear: vi.fn().mockReturnThis(),
                    lineStyle: vi.fn().mockReturnThis(),
                    fillStyle: vi.fn().mockReturnThis(),
                    fillRect: vi.fn().mockReturnThis(),
                    fillCircle: vi.fn().mockReturnThis(),
                    beginPath: vi.fn().mockReturnThis(),
                    moveTo: vi.fn().mockReturnThis(),
                    lineTo: vi.fn().mockReturnThis(),
                    closePath: vi.fn().mockReturnThis(),
                    fillPath: vi.fn().mockReturnThis(),
                    strokePath: vi.fn().mockReturnThis(),
                    generateTexture: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                }))
            };
            this.add = {
                text: vi.fn(() => ({
                    setName: vi.fn().mockReturnThis(),
                    setDepth: vi.fn().mockReturnThis(),
                    setScrollFactor: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    setText: vi.fn()
                })),
                circle: vi.fn(() => ({
                    setStrokeStyle: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    setScrollFactor: vi.fn().mockReturnThis(),
                    setDepth: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                })),
                rectangle: vi.fn(() => ({
                    setRotation: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    setScrollFactor: vi.fn().mockReturnThis(),
                    setDepth: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                })),
                mesh: vi.fn(),
                graphics: vi.fn(() => ({
                    setDepth: vi.fn().mockReturnThis(),
                    setScrollFactor: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    clear: vi.fn().mockReturnThis(),
                    fillStyle: vi.fn().mockReturnThis(),
                    fillRect: vi.fn().mockReturnThis(),
                    strokeRect: vi.fn().mockReturnThis(),
                    lineStyle: vi.fn().mockReturnThis(),
                    strokePath: vi.fn().mockReturnThis(),
                    beginPath: vi.fn().mockReturnThis(),
                    moveTo: vi.fn().mockReturnThis(),
                    lineTo: vi.fn().mockReturnThis(),
                    destroy: vi.fn().mockReturnThis(),
                    setVisible: vi.fn().mockReturnThis(),
                    fillPoints: vi.fn().mockReturnThis()
                })),
                sprite: vi.fn(() => ({
                    setTint: vi.fn().mockReturnThis(),
                    setRotation: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    destroy: vi.fn().mockReturnThis(),
                    setVisible: vi.fn().mockReturnThis(),
                    getBounds: vi.fn(() => ({ contains: () => false }))
                })),
                image: vi.fn(() => ({
                    setTint: vi.fn().mockReturnThis(),
                    setDepth: vi.fn().mockReturnThis(),
                    setScale: vi.fn().mockReturnThis(),
                    setDisplaySize: vi.fn().mockReturnThis(),
                    setAlpha: vi.fn().mockReturnThis(),
                    setInteractive: vi.fn().mockReturnThis(),
                    setName: vi.fn().mockReturnThis(),
                    setData: vi.fn().mockReturnThis(),
                    on: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    setScrollFactor: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                })),
                container: vi.fn(() => ({
                    add: vi.fn().mockReturnThis(),
                    setScrollFactor: vi.fn().mockReturnThis(),
                    setDepth: vi.fn().mockReturnThis(),
                    setVisible: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                }))
            };
            this.input = {
                keyboard: {
                    on: vi.fn()
                },
                on: vi.fn(),
                setPollAlways: vi.fn(),
                setDefaultCursor: vi.fn()
            };
            this.data = {
                set: vi.fn(),
                get: vi.fn()
            };
        }
    }
    
    return {
        default: {
            Scene,
            Game: vi.fn(),
            AUTO: 0,
            Scale: { RESIZE: 0, CENTER_BOTH: 0 },
            Utils: {
                String: {
                    UUID: vi.fn().mockReturnValue('mock-uuid')
                }
            },
            scale: { width: 800, height: 600 },
            GameObjects: { 
                Mesh: class {},
                Sprite: class {
                    setTint = vi.fn().mockReturnThis();
                    setRotation = vi.fn().mockReturnThis();
                    setScale = vi.fn().mockReturnThis();
                    setInteractive = vi.fn().mockReturnThis();
                    destroy = vi.fn().mockReturnThis();
                    setVisible = vi.fn().mockReturnThis();
                    getBounds = vi.fn(() => ({ contains: () => false }));
                },
                Graphics: class {
                    clear = vi.fn().mockReturnThis();
                    fillStyle = vi.fn().mockReturnThis();
                    fillRect = vi.fn().mockReturnThis();
                    strokeRect = vi.fn().mockReturnThis();
                    lineStyle = vi.fn().mockReturnThis();
                    strokePath = vi.fn().mockReturnThis();
                    beginPath = vi.fn().mockReturnThis();
                    moveTo = vi.fn().mockReturnThis();
                    lineTo = vi.fn().mockReturnThis();
                    destroy = vi.fn().mockReturnThis();
                    setDepth = vi.fn().mockReturnThis();
                    setVisible = vi.fn().mockReturnThis();
                    fillPoints = vi.fn().mockReturnThis();
                },
                Text: class {
                    setName = vi.fn().mockReturnThis();
                    setDepth = vi.fn().mockReturnThis();
                    setScrollFactor = vi.fn().mockReturnThis();
                    setText = vi.fn().mockReturnThis();
                    destroy = vi.fn().mockReturnThis();
                }
            },
            Math: {
                Distance: {
                    Between: vi.fn((x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)))
                },
                DegToRad: vi.fn((deg: number) => deg * (Math.PI / 180))
            }
        },
        Scene // Named export if needed
    };
});

// 2. Mock FleetRenderer
const mockUpdate = vi.fn();
vi.mock('../renderer/FleetRenderer', () => {
    return {
        FleetRenderer: vi.fn().mockImplementation(() => ({
            update: mockUpdate
        }))
    };
});

// 3. Mock RapierManager
const mockRapierInstance = {
    init: vi.fn(),
    world: {
        createRigidBody: vi.fn(() => ({
             translation: vi.fn(() => ({ x: 0, y: 0 })),
             rotation: vi.fn(() => 0),
             numColliders: vi.fn().mockReturnValue(0),
             collider: vi.fn(),
             userData: {}
        })),
        createCollider: vi.fn(),
        removeCollider: vi.fn(),
        removeRigidBody: vi.fn()
    },
    step: vi.fn(),
    drainCollisionEvents: vi.fn(),
    createPredictionWorld: vi.fn(),
    getAllBodyData: vi.fn(() => [])
};

vi.mock('../physics/RapierManager', () => {
    return {
        RapierManager: {
            getInstance: vi.fn(() => mockRapierInstance)
        }
    };
});

// Mock FXManager (Added)
vi.mock('../logic/FXManager', () => ({
    FXManager: {
        getInstance: vi.fn(() => ({
            createExplosion: vi.fn(),
            createDebrisBurst: vi.fn(),
            update: vi.fn(),
            showFloatingText: vi.fn(),
            createThrustEffect: vi.fn()
        })),
        init: vi.fn()
    }
}));

// 4. Mock @dimforge/rapier2d-compat
vi.mock('@dimforge/rapier2d-compat', () => {
    const rigidBodyDescMock = {
        setTranslation: vi.fn().mockReturnThis(),
        setLinvel: vi.fn().mockReturnThis(),
        setLinearDamping: vi.fn().mockReturnThis(),
        setAngularDamping: vi.fn().mockReturnThis(),
        setRotation: vi.fn().mockReturnThis(),
        setCcdEnabled: vi.fn().mockReturnThis()
    };
    
    return {
        RigidBodyDesc: {
            dynamic: vi.fn(() => rigidBodyDescMock),
            fixed: vi.fn(() => rigidBodyDescMock)
        },
        ColliderDesc: {
            ball: vi.fn(() => ({ 
                setActiveEvents: vi.fn().mockReturnThis(),
                setRestitution: vi.fn().mockReturnThis(),
                setFriction: vi.fn().mockReturnThis(),
                setDensity: vi.fn().mockReturnThis()
            })),
            cuboid: vi.fn(() => ({ 
                setActiveEvents: vi.fn().mockReturnThis(),
                setRestitution: vi.fn().mockReturnThis(),
                setFriction: vi.fn().mockReturnThis(),
                setDensity: vi.fn().mockReturnThis()
            })),
            polyline: vi.fn(() => ({ 
                setActiveEvents: vi.fn().mockReturnThis(),
                setRestitution: vi.fn().mockReturnThis(),
                setFriction: vi.fn().mockReturnThis(),
                setDensity: vi.fn().mockReturnThis()
            })),
            triangle: vi.fn(() => ({ 
                setActiveEvents: vi.fn().mockReturnThis(),
                setRestitution: vi.fn().mockReturnThis(),
                setFriction: vi.fn().mockReturnThis(),
                setDensity: vi.fn().mockReturnThis()
            }))
        },
        ActiveEvents: { COLLISION_EVENTS: 1 },
        default: {
             RigidBodyDesc: {
                dynamic: vi.fn(() => rigidBodyDescMock),
                fixed: vi.fn(() => rigidBodyDescMock)
            },
            ColliderDesc: {
                ball: vi.fn(() => ({ 
                    setActiveEvents: vi.fn().mockReturnThis(),
                    setRestitution: vi.fn().mockReturnThis(),
                    setFriction: vi.fn().mockReturnThis(),
                    setDensity: vi.fn().mockReturnThis()
                })),
                cuboid: vi.fn(() => ({ 
                    setActiveEvents: vi.fn().mockReturnThis(),
                    setRestitution: vi.fn().mockReturnThis(),
                    setFriction: vi.fn().mockReturnThis(),
                    setDensity: vi.fn().mockReturnThis()
                })),
                polyline: vi.fn(() => ({ 
                    setActiveEvents: vi.fn().mockReturnThis(),
                    setRestitution: vi.fn().mockReturnThis(),
                    setFriction: vi.fn().mockReturnThis(),
                    setDensity: vi.fn().mockReturnThis()
                })),
                triangle: vi.fn(() => ({ 
                    setActiveEvents: vi.fn().mockReturnThis(),
                    setRestitution: vi.fn().mockReturnThis(),
                    setFriction: vi.fn().mockReturnThis(),
                    setDensity: vi.fn().mockReturnThis()
                }))
            },
            ActiveEvents: { COLLISION_EVENTS: 1 },
            World: class {
                constructor() {}
                createRigidBody = vi.fn().mockImplementation(() => ({ 
                    userData: {},
                    numColliders: vi.fn().mockReturnValue(0),
                    collider: vi.fn(),
                    translation: vi.fn().mockReturnValue({ x: 0, y: 0 }),
                    rotation: vi.fn().mockReturnValue(0),
                    addForce: vi.fn(),
                    next: vi.fn()
                }));
                createCollider = vi.fn();
                removeCollider = vi.fn();
                removeRigidBody = vi.fn();
                step = vi.fn();
            }
        }
    };
});

// Import MainScene AFTER mocking
import { MainScene } from '../scenes/MainScene';
import { TurnPhase } from '../logic/TurnManager';
import { FleetRenderer } from '../renderer/FleetRenderer';
import { RapierManager } from '../physics/RapierManager'; // This imports the mock now

describe('MainScene Integration', () => {
    let scene: MainScene;
    let rapierManager: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        rapierManager = RapierManager.getInstance();
        scene = new MainScene();
    });

    it('should initialize physics and renderer in create()', async () => {
        await scene.create();
        expect(FleetRenderer).toHaveBeenCalled();
        expect(scene.add.text).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.stringContaining('Press SPACE'), expect.any(Object));
    });

    it('should setup input listeners', async () => {
        await scene.create();
        expect(scene.input.keyboard?.on).toHaveBeenCalledWith('keydown-SPACE', expect.any(Function));
    });

    it('should update physics and renderer when TurnManager is executing', async () => {
        await scene.create();
        
        // Mock get bodies
        rapierManager.getAllBodyData.mockReturnValue([{x:0, y:0, rotation:0}]);

        // Force into EXECUTION phase
        const turnManager = (scene as any).turnManager;
        turnManager.commitTurn(); 
        
        // Update scene
        scene.update(0, 100);

        expect(rapierManager.step).toHaveBeenCalled();
        expect(rapierManager.getAllBodyData).toHaveBeenCalled();
        
        // Check if renderer update was called
        expect(mockUpdate).toHaveBeenCalled();
    });

    it('should update UI text during phases', async () => {
        await scene.create();
        
        // Mock data.get to return our mocked text object
        // The mock 'add.text' returns an object, we need to make sure 'data.get' returns that logic
        const mockTextObj = { setText: vi.fn() };
        (scene.data.get as any).mockReturnValue(mockTextObj);

        const turnManager = (scene as any).turnManager;
        
        // Initial check
        scene.update(0, 16);
        expect(mockTextObj.setText).toHaveBeenCalledWith(`Phase: ${TurnPhase.PLANNING}`);
        
        // Switch to execution
        turnManager.commitTurn();
        scene.update(0, 16);
        expect(mockTextObj.setText).toHaveBeenCalledWith(`Phase: ${TurnPhase.EXECUTION}`);
    });
});
