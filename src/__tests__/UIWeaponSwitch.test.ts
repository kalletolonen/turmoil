
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIManager } from '../ui/UIManager';
import { ProjectileType } from '../objects/ProjectileTypes';
import { TurnPhase } from '../logic/TurnManager';

// Mock Phaser
vi.mock('phaser', () => {
    return {
        default: {
            Scene: class {},
            GameObjects: {
                Container: class {
                    add = vi.fn();
                    setScrollFactor = vi.fn();
                    setDepth = vi.fn();
                    setVisible = vi.fn();
                    getByName = vi.fn(); // Mocked later
                },
                Image: class {
                    setDisplaySize = vi.fn();
                    setTint = vi.fn();
                    setAlpha = vi.fn();
                    setInteractive = vi.fn();
                    on = vi.fn();
                    setName = vi.fn();
                    setData = vi.fn();
                    setOrigin = vi.fn();
                },
                Text: class {
                     setOrigin = vi.fn();
                }
            }
        }
    };
});

describe('Weapon Switching Logic', () => {
    let uiManager: UIManager;
    let scene: any;
    let selectedTurret: any;
    let mockTeamManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        
        selectedTurret = {
            id: 't1',
            teamId: 'red',
            projectileType: ProjectileType.BASIC,
            actionPoints: 10,
            armed: false,
            aimVector: null,
            setArmed: vi.fn(),
            addActionPoints: vi.fn(),
            consumeActionPoints: vi.fn(),
            updateHealthBar: vi.fn()
        };

        mockTeamManager = {
            getTeam: vi.fn().mockReturnValue({ isAI: false, color: 0xff0000 })
        };

        scene = {
            add: {
                container: vi.fn(() => ({
                     add: vi.fn(),
                     setScrollFactor: vi.fn(),
                     setDepth: vi.fn(),
                     setVisible: vi.fn(),
                     getByName: vi.fn()
                })),
                image: vi.fn(() => ({
                     setDisplaySize: vi.fn(),
                     setTint: vi.fn(),
                     setAlpha: vi.fn(),
                     setInteractive: vi.fn(),
                     on: vi.fn(),
                     setName: vi.fn(),
                     setData: vi.fn(),
                     setOrigin: vi.fn()
                })),
                text: vi.fn(() => ({
                     setOrigin: vi.fn()
                }))
            },
            scale: { width: 800, height: 600 },
            selectedTurret: selectedTurret,
            teamManager: mockTeamManager,
            turnManager: { currentPhase: TurnPhase.PLANNING },
            isDevMode: false
        };

        uiManager = new UIManager(scene);
        
        // Expose handleWeaponChange for testing (it's private)
        // We can simulate it by clicking the button, but simpler to check logic if we could access it.
        // Or we just verify that calling create + click works.
        uiManager.createWeaponSelectionUI();
    });

    it('should preserve aim vector when switching from Basic to Defender if AP allows', () => {
        // Setup: Turret is armed with Basic
        selectedTurret.armed = true;
        selectedTurret.aimVector = { x: 10, y: 10 };
        selectedTurret.projectileType = ProjectileType.BASIC;
        // Cost of Basic is 1. Cost of Defender is 2.
        // Turret has 10 AP.
        
        // Mock getByName to return button
        const mockButton = {
            name: `btn_${ProjectileType.DEFENDER}`,
            on: vi.fn()
        };
        // We can't easily trigger the 'pointerdown' from outside without references.
        // Let's call the private method directly via type casting
        (uiManager as any).handleWeaponChange(ProjectileType.DEFENDER);
        
        // Verification:
        // 1. Refund Basic (Cost 1) -> addActionPoints(1)
        expect(selectedTurret.addActionPoints).toHaveBeenCalledWith(1);
        
        // 2. Consume Defender (Cost 2) -> consumeActionPoints(2)
        expect(selectedTurret.consumeActionPoints).toHaveBeenCalledWith(2);
        
        // 3. Projectile Type Changed
        expect(selectedTurret.projectileType).toBe(ProjectileType.DEFENDER);
        
        // 4. Re-armed with same vector
        expect(selectedTurret.setArmed).toHaveBeenCalledWith(true, { x: 10, y: 10 });
    });

    it('should NOT re-arm if AP is insufficient for new weapon', () => {
        // Setup: Low AP
        selectedTurret.actionPoints = 0; // Has 0 AP available (already spent on Basic)
        // Basic cost 1. Refund gives +1. Total 1.
        // Defender cost 2. Need 2. 1 < 2 -> Fail.
        
        selectedTurret.armed = true;
        selectedTurret.aimVector = { x: 10, y: 10 };
        selectedTurret.projectileType = ProjectileType.BASIC;
        
        (uiManager as any).handleWeaponChange(ProjectileType.DEFENDER);
        
        // 1. Refund
        expect(selectedTurret.addActionPoints).toHaveBeenCalledWith(1);
        
        // 2. Projectile Type Changed
        expect(selectedTurret.projectileType).toBe(ProjectileType.DEFENDER);
        
        // 3. Should NOT Consume new cost (check fails)
        expect(selectedTurret.consumeActionPoints).not.toHaveBeenCalled();
        
        // 4. Should NOT Re-arm
        // setArmed(false) was called during refund
        // setArmed(true) should NOT be called later
        // We need to check call order or args.
        // The mock records all calls.
        // Expect calls: [ [false] ] (from refund)
        expect(selectedTurret.setArmed).toHaveBeenCalledTimes(1);
        expect(selectedTurret.setArmed).toHaveBeenCalledWith(false);
    });
});
