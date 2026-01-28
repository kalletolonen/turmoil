import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { Projectile } from '../objects/Projectile';
import { Turret } from '../objects/Turret';
import { GravitySystem } from './GravitySystem';
import { ProjectileType } from '../objects/ProjectileTypes';
import RAPIER from '@dimforge/rapier2d-compat';
import { GameConfig } from '../config';

export class TrajectorySystem {
    private scene: MainScene;
    
    // Constants from MainScene
    private readonly DRAG_SPEED_SCALE = 2.0;


    constructor(scene: MainScene) {
        this.scene = scene;
    }

    public predictTrajectory(graphics: Phaser.GameObjects.Graphics) {
        const predictionWorld = this.scene.rapierManager.createPredictionWorld();
        if (!predictionWorld) return;

        // Ensure collision events are enabled for all colliders (snapshot might lose them or we want to be sure)
        predictionWorld.forEachCollider(c => {
            c.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        });

        const ghostProjectiles: Projectile[] = [];
        
        // Helper to add ghost
        const addGhost = (t: Turret, startPos: {x: number, y: number}, direction: {x: number, y: number}) => {
            const angle = Math.atan2(direction.y, direction.x);
            const speed = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
            
            const tipLen = 15;
            const tipX = startPos.x + Math.cos(angle) * tipLen;
            const tipY = startPos.y + Math.sin(angle) * tipLen;
            
            // Pass teamId
            const ghost = new Projectile(this.scene, tipX, tipY, angle, speed, predictionWorld, t.projectileType, t.teamId);
            ghost.setVisible(false);
            // Store color for drawing
            const team = this.scene.teamManager.getTeam(t.teamId || '');
            (ghost as any).trajectoryColor = team ? team.color : 0xffff00;
            
            ghostProjectiles.push(ghost);
        };
        
        // 1. Add already armed turrets
        this.scene.planets.forEach(p => {
            p.turretsList.forEach(t => {
                if (t === this.scene.inputManager.draggingTurret) return;
                
                // Filter AI trajectories
                const team = this.scene.teamManager.getTeam(t.teamId || '');
                if (team && team.isAI) {
                    // Check if player has Radar
                    let hasRadar = false;
                    // Scan all planets for player turrets with Radar
                    // Assuming player is always valid team (not AI)? Or checking specifically for 'player' team?
                    // We can check if ANY non-AI turret has Radar?
                    // Or specifically the local player? For now, we assume non-AI teams are the player.
                    
                    for (const planet of this.scene.planets) {
                        for (const turret of planet.turretsList) {
                            const turretTeam = this.scene.teamManager.getTeam(turret.teamId || '');
                            // If it's a player turret (not AI) and has Radar
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
                    addGhost(t, t.position, t.aimVector);
                }
            });
        });
        
        // 2. Add currently dragged turret prediction
        if (this.scene.inputManager.draggingTurret && this.scene.inputManager.dragCurrentPos) {
            const t = this.scene.inputManager.draggingTurret;
            const start = t.position;
            const current = { x: this.scene.inputManager.dragCurrentPos.x, y: this.scene.inputManager.dragCurrentPos.y };
            // Drag logic duplicates logic in pointerup: Pull back to shoot forward
            const dx = start.x - current.x;
            const dy = start.y - current.y;
            
            let vx = dx * this.DRAG_SPEED_SCALE;
            let vy = dy * this.DRAG_SPEED_SCALE;
            
            const speed = Math.sqrt(vx*vx + vy*vy);
            if (speed > GameConfig.MAX_PROJECTILE_SPEED) {
                const scale = GameConfig.MAX_PROJECTILE_SPEED / speed;
                vx *= scale;
                vy *= scale;
            }
            
            // Only predict if meaningful drag
            if (speed > 1) {
                addGhost(t, start, { x: vx, y: vy });
            }
        }

        if (ghostProjectiles.length === 0) {
            predictionWorld.free();
            return;
        }

        // Simulate N steps
        const steps = 180; // 3 seconds

        const eventQueue = new RAPIER.EventQueue(true);
        // Map body handle to ghost projectile
        const ghostMap = new Map<number, Projectile>();
        ghostProjectiles.forEach(g => {
            // Access private bodyId (or expose it via getter). Using any for now as quick fix.
            const body = (g as any).bodyId; 
            if (body) {
                ghostMap.set(body.handle, g);
            }
        });

        for (let i = 0; i < steps; i++) {
            if (ghostMap.size === 0) break;

            // Store previous positions for raycasting
            const prevPositions = new Map<number, {x: number, y: number}>();
            ghostMap.forEach((g, handle) => {
                prevPositions.set(handle, { x: g.x, y: g.y });
            });

            const activeArray = Array.from(ghostMap.values());
            GravitySystem.applyGravity(activeArray, this.scene.planets);
            
            predictionWorld.step(eventQueue);
            
            // 1. Check Physics Events (keep good logic)
            eventQueue.drainCollisionEvents((handle1, handle2, started) => {
                if (!started) return;
                
                // Get colliders
                const c1 = predictionWorld.getCollider(handle1);
                const c2 = predictionWorld.getCollider(handle2);
                if (!c1 || !c2) return;
                
                // Get parents (bodies)
                const b1 = c1.parent();
                const b2 = c2.parent();
                if (!b1 || !b2) return;
                
                const h1 = b1.handle;
                const h2 = b2.handle;
                
                // Check if either body is a ghost
                if (ghostMap.has(h1)) {
                    const g = ghostMap.get(h1)!;
                    g.destroy();
                    ghostMap.delete(h1);
                }
                
                if (ghostMap.has(h2)) {
                    const g = ghostMap.get(h2)!;
                    g.destroy();
                    ghostMap.delete(h2);
                }
            });

            // 2. Manual Raycast Check (Fallback for tunneling/thin walls)
            ghostMap.forEach((g, handle) => {
                const prev = prevPositions.get(handle);
                if (!prev) return;
                
                // Ray from prev to current
                const dx = g.x - prev.x;
                const dy = g.y - prev.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > 0.001) {
                     const dir = { x: dx/dist, y: dy/dist };
                     const ray = new RAPIER.Ray({ x: prev.x, y: prev.y }, dir);
                     
                     // We need to ignore the projectile's own collider
                     // But accessing collider from ghost is tricky if private.
                     // However, Raycast can just check `toi`. If `toi < dist` and hit is NOT self.
                     // Actually, usually we can pass a filter.
                     
                     // Simple approach: Interaction groups or predicate.
                     // `castRay` signature: (ray, maxToi, solid, groups, filter, filterData, target)
                     // or CastRay(ray, maxToi, true)
                     
                     const hit = predictionWorld.castRay(ray, dist, true);
                     if (hit) {
                         // Check what we hit.
                         // If we hit ourself, ignore.
                         const collider = hit.collider;
                         const parent = collider.parent();
                         
                         if (parent && parent.handle !== handle) {
                             // Hit something else (Planet!)
                             // console.log("Raycast Hit!", parent.handle);
                             g.destroy();
                             ghostMap.delete(handle);
                         }
                     }
                }
            });

            // Update Graphics
            ghostMap.forEach((ghost) => {
                const startPos = { x: ghost.x, y: ghost.y };
                ghost.update(); // Update sprite from body
                const endPos = { x: ghost.x, y: ghost.y };
                
                const color = (ghost as any).trajectoryColor || 0xffff00;
                graphics.lineStyle(2, color, 0.5);
                graphics.lineBetween(startPos.x, startPos.y, endPos.x, endPos.y);
            });
        }
        
        ghostProjectiles.forEach(g => {
            if (g.active) g.destroy(); // Cleanup remaining
        });
        
        predictionWorld.free();
    }
}
