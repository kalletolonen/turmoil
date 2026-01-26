import { describe, it, expect, vi } from 'vitest';
import { AIManager } from '../logic/AIManager';

vi.mock('../physics/RapierManager', () => {
    return {
        RapierManager: {
            getInstance: () => ({
                world: {}
            })
        }
    }
});

vi.mock('../physics/PhysicsSimulator', () => {
    return {
        PhysicsSimulator: vi.fn().mockImplementation(() => ({
            syncPlanets: vi.fn(),
            simulateShot: vi.fn(() => ({ hit: false, closestDist: 100, hitFriendly: false }))
        }))
    }
});

// Mock Phaser
vi.mock('phaser', () => {
    return {
        default: {
            Math: {
                DegToRad: (deg: number) => deg * (Math.PI / 180),
            }
        },
        Math: {
            DegToRad: (deg: number) => deg * (Math.PI / 180),
        }
    }
});

function createMockPlanet(x: number, y: number, radius: number) {
    return {
        position: { x, y },
        radiusValue: radius
    } as any;
}

describe('AIManager', () => {
    it('should simulate bullet trajectory', () => {
        const ai = new AIManager();
        ai.init();
        const start = { x: 0, y: 0 };
        const target = { x: 100, y: 0 };
        const planets = [ createMockPlanet(50, 50, 20) ]; 

        // Access private method
        const result = (ai as any).findFiringSolution({ position: start, rotation: 0 }, target, 20, planets, 'bot');
        
        expect(result).toBeDefined();
        if (result) {
            expect(typeof result.angle).toBe('number');
            expect(typeof result.speed).toBe('number');
        }
    });
    
    it('should find firing solution in empty space', () => {
        const ai = new AIManager();
        ai.init();
        const turret = {
            position: { x: 0, y: 0 }
        } as any;
        const targetPos = { x: 200, y: 0 };
        const planets: any[] = [];
        
        // Without planets, a direct shot (angle 0) should work if speed is sufficient
        // The AI heuristic tries "distance / 10" = 20 speed.
        // It tries random variations.
        // Ideally one of them hits.
        
        const solution = (ai as any).findFiringSolution(turret, targetPos, 20, planets, 'bot');
        
        expect(solution).not.toBeNull();
        if(solution) {
            // Angle should be roughly 0 (direct)
            // It might be slightly off due to randomization
            expect(Math.abs(solution.angle)).toBeLessThan(0.5); // Generous tolerance
            expect(solution.speed).toBeGreaterThan(0);
        }
    });

    it('should calculate moves for a team', () => {
        const ai = new AIManager();
        ai.init();
        
        // Mock Team
        const aiTeam = {
            isAI: true,
            name: "Bot",
            resources: 10,
            planets: [
                {
                    turretsList: [
                        {
                            position: { x: 0, y: 0 },
                            armed: false,
                            actionPoints: 10,
                            projectileType: 'basic',
                            setArmed: vi.fn(),
                            teamId: 'bot'
                        }
                    ],
                    position: { x: 0, y: 0 }
                }
            ]
        } as any;

        const enemyTeam = {
            isAlive: true,
            planets: [
                {
                    turretsList: [
                        { position: { x: 200, y: 0 } }
                    ],
                    position: { x: 200, y: 0 } // Target
                }
            ]
        } as any;

        // const allTeams = [aiTeam, enemyTeam];
        const planets: any[] = [];

        ai.calculateMoves(aiTeam, [enemyTeam], planets);

        // Should have tried to arm the turret
        // The probability depends on finding a solution. In empty space, it should find one.
        // However, randomization might miss occasionally, but with 20 attempts it's likely high.
        
        // Only verify if setArmed is called if a solution was found.
        // We can't guarantee it in a probabilistic test, but we can check if it ran without error.
        expect(aiTeam.planets[0].turretsList[0].setArmed).toHaveBeenCalledTimes(1); 
        // Note: It might be called with true or not called if failed.
        // Actually code says: if solution found -> setArmed(true...)
        // If not found, nothing happens.
        // So checking 1 call implies success.
    });
});
