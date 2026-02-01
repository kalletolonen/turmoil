import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { GravitySystem } from './GravitySystem';
import { ProjectileType } from '../objects/ProjectileTypes';
import { GameConfig } from '../config';


interface TrajectoryPoint {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export class TrajectorySystem {
    private scene: MainScene;
    
    // Constants from MainScene
    // private readonly DRAG_SPEED_SCALE = 0.032; // Moved to GameConfig
    private readonly PROJECTILE_RADIUS = 5;

    constructor(scene: MainScene) {
        this.scene = scene;
    }

    public predictTrajectory(graphics: Phaser.GameObjects.Graphics) {
        const trajectories: Array<{ points: TrajectoryPoint[], color: number }> = [];
        
        // Helper to simulate trajectory
        const simulateTrajectory = (
            startX: number, 
            startY: number, 
            vx: number, 
            vy: number
        ): TrajectoryPoint[] => {
            const points: TrajectoryPoint[] = [];
            let x = startX;
            let y = startY;
            let velX = vx;
            let velY = vy;
            
            const maxSteps = 180; // 3 seconds at 60fps
            
            for (let step = 0; step < maxSteps; step++) {
                // Store point at current position
                points.push({ x, y, vx: velX, vy: velY });
                
                // Calculate gravity forces (matching GravitySystem.ts)
                let forceX = 0;
                let forceY = 0;
                const projectileMass = 1.0; // Matches Projectile.ts density calculation
                
                for (const planet of this.scene.planets) {
                    const dx = planet.position.x - x;
                    const dy = planet.position.y - y;
                    const distSq = dx * dx + dy * dy;
                    
                    // Optimization: Influence check (matching GravitySystem)
                    const influenceDist = planet.radiusValue * GravitySystem.INFLUENCE_MULTIPLIER;
                    if (distSq > influenceDist * influenceDist) continue;
                    
                    const dist = Math.sqrt(distSq);
                    
                    // Check collision with planet
                    if (dist < planet.radiusValue + this.PROJECTILE_RADIUS) {
                        // Hit planet, stop simulation
                        return points;
                    }
                    
                    // Calculate gravity force (matching GravitySystem.ts exactly)
                    const planetMass = planet.radiusValue * planet.radiusValue;
                    const clampedDist = Math.max(dist, planet.radiusValue * 0.3);
                    const clampedDistSq = clampedDist * clampedDist;
                    
                    let forceMagnitude = (GravitySystem.G * planetMass) / clampedDistSq;
                    forceMagnitude *= projectileMass;
                    
                    // Normalize and accumulate force
                    forceX += (dx / dist) * forceMagnitude;
                    forceY += (dy / dist) * forceMagnitude;
                }
                
                // Semi-implicit Euler integration (matching Rapier):
                // 1. Update velocity first: v_new = v_old + a * dt
                // 2. Update position with new velocity: x_new = x_old + v_new * dt
                // Since we're working in per-frame units, dt = 1
                const accelX = forceX / projectileMass;
                const accelY = forceY / projectileMass;
                
                velX += accelX;
                velY += accelY;
                
                // Update position with new velocity (semi-implicit)
                x += velX;
                y += velY;
                
                // Out of bounds check
                if (x < -2000 || x > 4000 || y < -2000 || y > 4000) {
                    break;
                }
            }
            
            return points;
        };
        
        // 1. Add already armed turrets
        this.scene.planets.forEach(p => {
            p.turretsList.forEach(t => {
                if (this.scene.inputManager && t === this.scene.inputManager.draggingTurret) return;
                
                // Filter AI trajectories
                const team = this.scene.teamManager.getTeam(t.teamId || '');
                if (team && team.isAI) {
                    // Check if player has Radar
                    let hasRadar = false;
                    
                    for (const planet of this.scene.planets) {
                        for (const turret of planet.turretsList) {
                            const turretTeam = this.scene.teamManager.getTeam(turret.teamId || '');
                            if (turretTeam && !turretTeam.isAI && turret.projectileType === ProjectileType.RADAR) {
                                hasRadar = true;
                                break;
                            }
                        }
                        if (hasRadar) break;
                    }

                    if (!this.scene.showAITrajectories && !hasRadar) {
                        return;
                    }
                }

                if (t.armed && t.aimVector) {
                    const angle = Math.atan2(t.aimVector.y, t.aimVector.x);
                    const tipLen = GameConfig.PROJECTILE_SPAWN_OFFSET;
                    const startX = t.position.x + Math.cos(angle) * tipLen;
                    const startY = t.position.y + Math.sin(angle) * tipLen;
                    
                    const teamColor = team ? team.color : 0xffff00;
                    const points = simulateTrajectory(startX, startY, t.aimVector.x, t.aimVector.y);
                    trajectories.push({ points, color: teamColor });
                }
            });
        });
        
        // 2. Add currently dragged turret prediction
        if (this.scene.inputManager && this.scene.inputManager.draggingTurret && this.scene.inputManager.dragCurrentPos) {
            const t = this.scene.inputManager.draggingTurret;
            const start = t.position;
            const current = { x: this.scene.inputManager.dragCurrentPos.x, y: this.scene.inputManager.dragCurrentPos.y };
            
            const dx = start.x - current.x;
            const dy = start.y - current.y;
            
            let vx = dx * GameConfig.DRAG_SPEED_SCALE;
            let vy = dy * GameConfig.DRAG_SPEED_SCALE;
            
            const speed = Math.sqrt(vx*vx + vy*vy);
            if (speed > GameConfig.MAX_PROJECTILE_SPEED) {
                const scale = GameConfig.MAX_PROJECTILE_SPEED / speed;
                vx *= scale;
                vy *= scale;
            }
            
            if (speed > 1) {
                const angle = Math.atan2(vy, vx);
                const tipLen = GameConfig.PROJECTILE_SPAWN_OFFSET;
                const startX = start.x + Math.cos(angle) * tipLen;
                const startY = start.y + Math.sin(angle) * tipLen;
                
                const team = this.scene.teamManager.getTeam(t.teamId || '');
                const teamColor = team ? team.color : 0xffff00;
                const points = simulateTrajectory(startX, startY, vx, vy);
                trajectories.push({ points, color: teamColor });
            }
        }

        // Draw all trajectories with dotted style (Angry Birds)
        trajectories.forEach(({ points, color }) => {
            const dotRadius = 3; // Slightly larger for visibility
            
            // Spatial spacing logic: only draw if we've moved enough distance
            let lastDrawX = -9999;
            let lastDrawY = -9999;
            const minSpacing = 15; // 15 pixels between dots

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const distSinceLast = Phaser.Math.Distance.Between(p.x, p.y, lastDrawX, lastDrawY);
                
                if (distSinceLast >= minSpacing) {
                    graphics.fillStyle(color, 1.0); // Fully opaque
                    graphics.fillCircle(p.x, p.y, dotRadius);
                    lastDrawX = p.x;
                    lastDrawY = p.y;
                }
            }
        });
    }
}
