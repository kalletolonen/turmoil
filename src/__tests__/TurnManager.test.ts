import { describe, it, expect, vi } from 'vitest';
import { TurnManager, TurnPhase } from '../logic/TurnManager';

describe('TurnManager', () => {
    it('should start in PLANNING phase', () => {
        const turnManager = new TurnManager();
        expect(turnManager.currentPhase).toBe(TurnPhase.PLANNING);
    });

    it('should switch to EXECUTION on commit', () => {
        const turnManager = new TurnManager();
        turnManager.commitTurn();
        expect(turnManager.currentPhase).toBe(TurnPhase.EXECUTION);
    });

    it('should update timer and return true for physics step during EXECUTION', () => {
        const turnManager = new TurnManager();
        turnManager.commitTurn();
        
        const shouldStep = turnManager.update(100); // 100ms
        expect(shouldStep).toBe(true);
    });

    it('should finish execution after duration and return to PLANNING (async mock)', async () => {
        vi.useFakeTimers();
        const turnManager = new TurnManager();
        turnManager.commitTurn();
        
        // Advance time by 5000ms
        turnManager.update(5000);
        
        // It transitions to RESOLUTION first
        expect(turnManager.currentPhase).toBe(TurnPhase.RESOLUTION);
        
        // Then after timeout (mocked) to PLANNING
        vi.runAllTimers();
        expect(turnManager.currentPhase).toBe(TurnPhase.PLANNING);
        
        vi.useRealTimers();
    });
    
    it('should NOT step physics in PLANNING phase', () => {
        const turnManager = new TurnManager();
        const shouldStep = turnManager.update(16);
        expect(shouldStep).toBe(false);
    });
});
