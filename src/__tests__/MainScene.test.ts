import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock Phaser module fully BEFORE importing MainScene
vi.mock('phaser', () => {
    // Mock for Phaser.Scene class
    class Scene {
        add: any;
        input: any;
        data: any;
        constructor() {
            this.add = {
                text: vi.fn(() => ({
                    setName: vi.fn().mockReturnThis(),
                    setDepth: vi.fn().mockReturnThis(),
                    setScrollFactor: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    setText: vi.fn()
                })),
                circle: vi.fn(() => ({
                    setStrokeStyle: vi.fn().mockReturnThis(),
                    setPosition: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                })),
                rectangle: vi.fn(() => ({
                    setRotation: vi.fn().mockReturnThis(),
                    destroy: vi.fn()
                })),
                mesh: vi.fn()
            };
            this.input = {
                keyboard: {
                    on: vi.fn()
                }
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
            GameObjects: { Mesh: class {} },
            Math: {
                Distance: {
                    Between: vi.fn((x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)))
                }
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
             userData: {}
        })),
        createCollider: vi.fn()
    },
    step: vi.fn(),
    getAllBodyData: vi.fn(() => [])
};

vi.mock('../physics/RapierManager', () => {
    return {
        RapierManager: {
            getInstance: vi.fn(() => mockRapierInstance)
        }
    };
});

// 4. Mock @dimforge/rapier2d-compat
vi.mock('@dimforge/rapier2d-compat', () => {
    const rigidBodyDescMock = {
        setTranslation: vi.fn().mockReturnThis(),
        setLinvel: vi.fn().mockReturnThis(),
        setLinearDamping: vi.fn().mockReturnThis(),
        setAngularDamping: vi.fn().mockReturnThis(),
        setRotation: vi.fn().mockReturnThis()
    };
    
    return {
        RigidBodyDesc: {
            dynamic: vi.fn(() => rigidBodyDescMock),
            fixed: vi.fn(() => rigidBodyDescMock)
        },
        ColliderDesc: {
            ball: vi.fn(),
            cuboid: vi.fn()
        },
        default: {
             RigidBodyDesc: {
                dynamic: vi.fn(() => rigidBodyDescMock),
                fixed: vi.fn(() => rigidBodyDescMock)
            },
            ColliderDesc: {
                ball: vi.fn(),
                cuboid: vi.fn()
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
