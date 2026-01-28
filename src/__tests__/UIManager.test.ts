
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIManager } from '../ui/UIManager';
import { MainScene } from '../scenes/MainScene';
import { ProjectileType } from '../objects/ProjectileTypes';

// Mock dependencies
vi.mock('../scenes/MainScene');

describe('UIManager', () => {
    let uiManager: UIManager;
    let mockScene: any;
    let mockContainer: any;

    beforeEach(() => {
        // Setup mock container
        mockContainer = {
            setScrollFactor: vi.fn(),
            setDepth: vi.fn(),
            add: vi.fn(),
            setVisible: vi.fn(),
            getByName: vi.fn(),
            destroy: vi.fn()
        };

        // Setup mock scene
        mockScene = {
            add: {
                container: vi.fn().mockReturnValue(mockContainer),
                image: vi.fn().mockReturnValue({ setDisplaySize: vi.fn(), setTint: vi.fn(), setAlpha: vi.fn(), setInteractive: vi.fn(), on: vi.fn(), setName: vi.fn() }),
                text: vi.fn().mockReturnValue({ setOrigin: vi.fn() })
            },
            scale: { width: 800, height: 600 },
            teamManager: {
                getTeam: vi.fn()
            },
            selectedTurret: null,
            turnManager: { currentPhase: 'PLANNING' }
        };

        uiManager = new UIManager(mockScene as unknown as MainScene);
        uiManager.createWeaponSelectionUI();
    });

    it('should hide weapon selector if no turret is selected', () => {
        mockScene.selectedTurret = null;
        uiManager.updateWeaponSelectionUI();
        expect(mockContainer.setVisible).toHaveBeenCalledWith(false);
    });

    it('should show weapon selector for player turret (team found, not AI)', () => {
        mockScene.selectedTurret = { teamId: 'player_team', projectileType: ProjectileType.BASIC };
        mockScene.teamManager.getTeam.mockReturnValue({ id: 'player_team', isAI: false });

        uiManager.updateWeaponSelectionUI();
        
        expect(mockContainer.setVisible).toHaveBeenCalledWith(true);
    });

    it('should show weapon selector for turret with unknown team (robustness)', () => {
        mockScene.selectedTurret = { teamId: 'unknown_team', projectileType: ProjectileType.BASIC };
        mockScene.teamManager.getTeam.mockReturnValue(undefined);

        uiManager.updateWeaponSelectionUI();
        
        expect(mockContainer.setVisible).toHaveBeenCalledWith(true);
    });

    it('should HIDE weapon selector for AI turret', () => {
        mockScene.selectedTurret = { teamId: 'ai_team', projectileType: ProjectileType.BASIC };
        mockScene.teamManager.getTeam.mockReturnValue({ id: 'ai_team', isAI: true });

        uiManager.updateWeaponSelectionUI();
        
        expect(mockContainer.setVisible).toHaveBeenCalledWith(false);
    });
});
