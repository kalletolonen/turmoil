
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainScene } from '../scenes/MainScene';
import { TurnManager, TurnPhase } from '../logic/TurnManager';
import { FXManager } from '../logic/FXManager';

// Mock Dependencies
vi.mock('../physics/RapierManager', () => ({
    RapierManager: {
        getInstance: vi.fn(() => ({
            init: vi.fn(),
            step: vi.fn(),
            getAllBodyData: vi.fn().mockReturnValue([]),
            world: {}
        }))
    }
}));

vi.mock('../logic/FXManager', () => ({
    FXManager: {
        instance: { update: vi.fn() },
        getInstance: vi.fn(() => ({
            update: vi.fn()
        })),
        init: vi.fn()
    }
}));

vi.mock('../objects/Debris', () => ({
    Debris: class { update = vi.fn() }
}));

vi.mock('../objects/Projectile', () => ({
    Projectile: class { update = vi.fn() }
}));

vi.mock('../objects/Turret', () => ({
    Turret: class { update = vi.fn() }
}));

vi.mock('../objects/Planet', () => ({
    Planet: class {}
}));

vi.mock('../renderer/FleetRenderer', () => ({
    FleetRenderer: class { update = vi.fn() }
}));

vi.mock('../logic/TeamManager', () => ({
    TeamManager: class {
        addTeam = vi.fn().mockReturnValue({ id: 'red' });
        getTeam = vi.fn();
    }
}));

vi.mock('../logic/AIManager', () => ({
    AIManager: class { init = vi.fn() }
}));

vi.mock('../ui/UIManager', () => ({
    UIManager: class {
        createWeaponSelectionUI = vi.fn();
        createDebugUI = vi.fn();
        updateWeaponSelectionUI = vi.fn();
    }
}));

vi.mock('../input/InputManager', () => ({
    InputManager: class { handleInput = vi.fn() }
}));

vi.mock('../logic/TrajectorySystem', () => ({
    TrajectorySystem: class { predictTrajectory = vi.fn() }
}));

vi.mock('../logic/CombatManager', () => ({
    CombatManager: class {}
}));

vi.mock('../logic/CollisionManager', () => ({
    CollisionManager: class { update = vi.fn() }
}));

vi.mock('../renderer/TextureGenerator', () => ({
    TextureGenerator: { generate: vi.fn() }
}));

vi.mock('../logic/MapGenerator', () => ({
    MapGenerator: class { generate = vi.fn().mockReturnValue({ planets: [] }) }
}));

// Mock Phaser
vi.mock('phaser', () => {
    return {
        default: {
            Scene: class {
                add = {
                    graphics: vi.fn(() => ({
                        setDepth: vi.fn(),
                        clear: vi.fn(),
                        destroy: vi.fn()
                    })),
                    text: vi.fn(() => ({
                        setScrollFactor: vi.fn(),
                        setDepth: vi.fn(),
                        setName: vi.fn(),
                        destroy: vi.fn()
                    })),
                    image: vi.fn()
                };
                data = {
                    set: vi.fn(),
                    get: vi.fn()
                };
                scale = { width: 800, height: 600 };
                input = { on: vi.fn() };
            },
            GameObjects: { 
                Graphics: class {},
                Text: class {}
            }
        }
    };
});

describe('Pause Logic', () => {
    let scene: MainScene;
    let mockFXUpdate: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Setup FXManager Mock
        mockFXUpdate = vi.fn();
        (FXManager.getInstance as any).mockReturnValue({
            update: mockFXUpdate
        });

        scene = new MainScene();
        // Initialize simple mocks
        scene.turnManager = new TurnManager();
        scene.rapierManager = { step: vi.fn(), getAllBodyData: vi.fn() } as any;
        scene.fleetRenderer = { update: vi.fn() } as any;
        scene.collisionManager = { update: vi.fn() } as any;
        scene.trajectorySystem = { predictTrajectory: vi.fn() } as any;
        scene.uiManager = { updateWeaponSelectionUI: vi.fn(), createWeaponSelectionUI: vi.fn(), createDebugUI: vi.fn() } as any;
        scene.inputManager = { handleInput: vi.fn() } as any;
        scene['graphics'] = { clear: vi.fn(), destroy: vi.fn() } as any; // Mock graphics
        scene['initialized'] = true; // Force initialized
    });

    it('should NOT update FXManager (debris) during PLANNING phase', () => {
        // Setup: PLANNING phase
        scene.turnManager.currentPhase = TurnPhase.PLANNING;
        
        // Run update
        scene.update(1000, 16);
        
        // Assert: FXManager.update should NOT be called
        // NOTE: This test is expected to FAIL before the fix
        expect(mockFXUpdate).not.toHaveBeenCalled();
    });

    it('should update FXManager (debris) during EXECUTION phase', () => {
        // Setup: EXECUTION phase
        scene.turnManager.currentPhase = TurnPhase.EXECUTION;
        scene.turnManager.update = vi.fn().mockReturnValue(true); // Should step
        
        // Run update
        scene.update(1000, 16);
        
        // Assert
        expect(mockFXUpdate).toHaveBeenCalledWith(16);
    });
});
