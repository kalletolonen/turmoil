import { Team } from './TeamManager';
import { Planet } from '../objects/Planet';
import { Turret } from '../objects/Turret';

import { PhysicsSimulator } from '../physics/PhysicsSimulator';
import { PROJECTILE_DATA } from '../objects/ProjectileTypes';
import { GameConfig } from '../config';
import Phaser from 'phaser';

export class AIManager {
    private physicsSimulator: PhysicsSimulator | null = null;

    constructor() {
        
    }

    public init() {
        this.physicsSimulator = new PhysicsSimulator();
    }

    public calculateMoves(aiTeam: Team, enemies: Team[], planets: Planet[]) {
        if (!aiTeam.isAI) return;
        if (!this.physicsSimulator) {
            console.warn("AI Physics Simulator not initialized!");
            return;
        }

        // Sync physics world for accurate simulation
        this.physicsSimulator.syncPlanets(planets);

        // console.log(`AI (${aiTeam.name}) thinking...`);

        // 1. Identify Potential Targets
        const potentialTargets: { pos: {x: number, y: number}, radius: number, priority: number }[] = [];

        enemies.forEach(enemy => {
            if (!enemy.isAlive) return;
            enemy.planets.forEach(p => {
                // Turrets are high priority
                p.turretsList.forEach(t => {
                   potentialTargets.push({ pos: t.position, radius: 15, priority: 10 }); 
                });
                // Planets removed from targeting to prioritize turrets (and fix count confusion)
                // potentialTargets.push({ pos: p.position, radius: p.radiusValue, priority: 5 });
            });
        });

        if (potentialTargets.length === 0) {
            // console.log("AI: No targets found");
            return;
        }

        // Sort by priority (descending) + some random shuffle to avoid predictability
        potentialTargets.sort((a, b) => (b.priority + Math.random() * 5) - (a.priority + Math.random() * 5));

        // console.log(`AI: Found ${potentialTargets.length} targets. Processing per turret...`);

        // 2. Iterate each AI Turret
        aiTeam.planets.forEach(myPlanet => {
            myPlanet.turretsList.forEach(myTurret => {
                // Check AP
                const stats = PROJECTILE_DATA[myTurret.projectileType];
                if (myTurret.actionPoints < stats.cost) {
                    // console.log(`Turret ${myTurret.id.substr(0,4)} skipped: Not enough AP (${myTurret.actionPoints}/${stats.cost})`);
                    return; 
                }

                // Try up to 10 targets
                const maxAttempts = 10;

                for (let i = 0; i < maxAttempts; i++) {
                    const poolSize = Math.min(potentialTargets.length, 15);
                    const targetIdx = Math.floor(Math.random() * poolSize);
                    const target = potentialTargets[targetIdx];
                    
                    if (!target) break;

                    const solution = this.findFiringSolution(myTurret, target.pos, target.radius, planets, aiTeam.id);
                    
                    if (solution) {
                         // Apply noise
                        const errorAngle = Phaser.Math.DegToRad(2); 
                        const errorSpeed = 2.0; 

                        const noisyAngle = solution.angle + (Math.random() * errorAngle * 2 - errorAngle);
                        const noisySpeed = solution.speed + (Math.random() * errorSpeed * 2 - errorSpeed);

                        // Safety Check: Simulate the noisy shot!
                        // Need velocity components
                        const vx = Math.cos(noisyAngle) * noisySpeed;
                        const vy = Math.sin(noisyAngle) * noisySpeed;

                        const safetyCheck = this.physicsSimulator!.simulateShot(
                            myTurret.position, 
                            { x: vx, y: vy }, 
                            planets, 
                            target.pos, 
                            target.radius, 
                            aiTeam.id
                        );
                        
                        if (safetyCheck.hitFriendly) {
                            // console.log(`[AI] Turret ${myTurret.id.substring(0,4)} ABORT: Noisy shot would hit friendly!`);
                            continue; // Try next attempt/target
                        }

                        // console.log(`[AI] Turret ${myTurret.id.substring(0,4)} firing at target distance ${Math.floor(solution.speed)}.`);
                        // console.log(`     Type: ${myTurret.projectileType}, AP: ${myTurret.actionPoints}, Target Priority: ${target.priority}`);

                        myTurret.setArmed(true, { x: vx, y: vy });
                        break; // Move to next turret
                    } else {
                        // console.log(`[AI] Turret ${myTurret.id.substring(0,4)} - No solution for attempt ${i+1}`);
                    }
                }
            });
        });
    }

    private findFiringSolution(turret: Turret, targetPos: {x: number, y: number}, targetRadius: number, planets: Planet[], myTeamId: string): { angle: number, speed: number } | null {
        const startPos = turret.position;
        const attempts = 40; 
        
        let bestShot: { angle: number, speed: number } | null = null;
        let minDist = Infinity;

        // Heuristic start
        const dx = targetPos.x - startPos.x;
        const dy = targetPos.y - startPos.y;
        const directAngle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Planet Normal (Up vector)
        const upAngle = turret.rotation; 

        const baseSpeed = dist * 0.9; 

        for (let i = 0; i < attempts; i++) {
            let testAngle: number;
            let testSpeed: number;

            // Strategy Mix:
            // 0-9: Direct shots (good for line of sight)
            // 10-39: Hemisphere shots (good for gravity bend)
            if (i < 10) {
                 testAngle = directAngle + (Math.random() * 0.5 - 0.25);
                 testSpeed = baseSpeed * (0.8 + Math.random() * 0.4);
            } else {
                 // Scan the entire visible sky relative to the turret
                 // Range: [upAngle - PI/2, upAngle + PI/2]
                 // We add a slight buffer to avoid shooting exactly parallel to ground?
                 const range = Math.PI - 0.2; // ~170 degrees
                 testAngle = upAngle + (Math.random() * range - range/2);
                 
                 // For indirect shots, we vary speed wildly
                 const minSpeed = GameConfig.MAX_PROJECTILE_SPEED * 0.2;
                 const maxSpeed = GameConfig.MAX_PROJECTILE_SPEED;
                 testSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);
            }

            if (testSpeed > GameConfig.MAX_PROJECTILE_SPEED) testSpeed = GameConfig.MAX_PROJECTILE_SPEED;

            const vx = Math.cos(testAngle) * testSpeed;
            const vy = Math.sin(testAngle) * testSpeed;

            const result = this.physicsSimulator!.simulateShot(
                startPos, 
                { x: vx, y: vy }, 
                planets, 
                targetPos, 
                targetRadius, 
                myTeamId
            );
            
            if (result.hit) {
                return { angle: testAngle, speed: testSpeed };
            }

            if (result.closestDist < minDist) {
                minDist = result.closestDist;
                // Only keep "best miss" if it didn't hit a friendly planet
                if (!result.hitFriendly) {
                    bestShot = { angle: testAngle, speed: testSpeed };
                }
            }
        }
        
        return bestShot;
    }


}
