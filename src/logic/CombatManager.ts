import Phaser from 'phaser';
import { Planet } from '../objects/Planet';
import { Turret } from '../objects/Turret';
import { FXManager } from './FXManager';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';

export class CombatManager {
  constructor() {}

  public applyRadialDamage(
    x: number, 
    y: number, 
    radius: number, 
    maxDamage: number, 
    planets: Planet[],
    pushForce: number = 0
  ) {
      if (maxDamage <= 0 || radius <= 0) return;
      if (!planets) return;

      const toDestroy: { turret: Turret, planet: Planet }[] = [];
      console.log(`[Combat] applyRadialDamage at ${x.toFixed(0)},${y.toFixed(0)} rad ${radius}. Planets: ${planets.length}`);

      planets.forEach(planet => {
           planet.turretsList.forEach(turret => {
              const dist = Phaser.Math.Distance.Between(x, y, turret.position.x, turret.position.y);
              if (dist <= radius) {
                  // Linear falloff: Max at 0, 0 at radius
                  const damage = Math.floor(maxDamage * (1 - dist / radius));
                  // console.log(`[Combat] Hit check: Dist ${dist.toFixed(1)} / Rad ${radius}. Damage: ${damage}. Turret ID: ${turret.id || 'N/A'}`);
                  
                      // Raycast Occlusion Check
                      const rapier = RapierManager.getInstance();
                      if (rapier.world) {
                          // Ray from explosion origin to turret center
                          const rayOrigin = { x: x, y: y };
                          const targetPos = turret.position;
                          const rayDir = { x: targetPos.x - x, y: targetPos.y - y };
                          const rayLen = Math.sqrt(rayDir.x * rayDir.x + rayDir.y * rayDir.y);
                          
                          if (rayLen > 0) {
                              // Normalize direction
                              const rayDirNorm = { x: rayDir.x / rayLen, y: rayDir.y / rayLen };
                              
                              // Offset origin slightly towards target (5px) to avoid self-occlusion if explosion is ON the surface
                              const offsetDist = 5;
                              const rayOriginOffset = { 
                                  x: rayOrigin.x + rayDirNorm.x * offsetDist, 
                                  y: rayOrigin.y + rayDirNorm.y * offsetDist 
                              };
                              
                              // Adjust ToI: 
                              // we moved origin +5, so distance remaining is rayLen - 5.
                              // We want to stop before hitting the turret (radius approx 10-15?), so stop 10px short of center.
                              // total check distance = (rayLen - 5) - 10 = rayLen - 15.
                              
                              const checkDist = rayLen - 15;

                              if (checkDist > 0) {
                                  const ray = new RAPIER.Ray(rayOriginOffset, rayDirNorm);
                                  const hit = rapier.world.castRay(ray, checkDist, true);
                                  
                                  if (hit) {
                                      const collider = hit.collider;
                                      const parentBody = collider ? collider.parent() : null;
                                      
                                      // Check userData on Body OR Collider (just in case)
                                      const bodyData = parentBody ? (parentBody as any).userData : null;
                                      const colliderData = (collider as any).userData;
                                      
                                      const isPlanet = (bodyData && bodyData.type === 'planet') || (colliderData && colliderData.type === 'planet');
                                      
                                      if (isPlanet) {
                                          // console.log(`[Combat] Blast occluded by Planet. Ray dist ${hit.toi.toFixed(1)}`);
                                          /** 
                                           * STUB: If you see this log, occlusion is working. 
                                           * If turrets still fly from underbelly hits, it means:
                                           * 1. The ray missed the planet (geometry hole?)
                                           * 2. The explosion was technically "above" the planet horizon relative to turret?
                                           */
                                          return; 
                                      }
                                  }
                              }
                          }
                      }

                      if (damage > 0) {
                          const destroyed = turret.takeDamage(damage);
                      console.log(`[Combat] Applied ${damage} damage to Turret. HP Remaining: ${turret.health}`);
                      
                      // "Blasted off" mechanics - Activate physics if damage is significant relative to max
                      // Lower threshold to 10 to allow minor shoves, but scale force
                      if (damage > 5 && !turret.isFalling) {
                           turret.setFalling(true);
                      }

                      if (turret.isFalling) {
                           // Apply Impulse away from explosion
                           // Scale force by proximity (damage / maxDamage)
                           const intensity = Math.min(1.0, damage / maxDamage);
                           
                           // Calculate vector from explosion to turret
                           const dx = turret.position.x - x;
                           const dy = turret.position.y - y;
                           let dist = Math.sqrt(dx*dx + dy*dy);
                           
                           let launchDirX = dx;
                           let launchDirY = dy;
                           
                           // Handle Direct Hits (or very close) by using Planet Normal
                           // This ensures turrets don't get stuck if hit strictly from "above" or inside
                           if (dist < 10) { 
                                // Launch away from planet center (Upwards)
                                launchDirX = turret.position.x - planet.position.x;
                                launchDirY = turret.position.y - planet.position.y;
                                dist = Math.sqrt(launchDirX*launchDirX + launchDirY*launchDirY);
                           }
                           
                           // Normalize
                           if (dist > 0) {
                               launchDirX /= dist;
                               launchDirY /= dist;
                           } else {
                               // Fallback
                               launchDirX = 0;
                               launchDirY = -1; 
                           }

                           // INSTANT OP: Nudge turret out of planet surface to prevent sticking
                           // Move 10 pixels along the launch vector (Increased from 3)
                           turret.nudge(launchDirX * 10, launchDirY * 10);
                           turret.lastLaunchTime = Date.now();

                           // PHYSICS TUNING
                           // Goal: Major airtime. Mass is ~1600.
                           const mass = turret.getMass();

                           const pushMultiplier = 60.0; // Reduced from 100
                           const baseLaunch = 600 * mass; // Reduced from 1000
                           
                           // Calculate Total Impulse
                           

                           // Calculate Total Impulse
                           const totalImpulse = (baseLaunch + pushForce * mass * pushMultiplier) * intensity;
                           
                           const ix = launchDirX * totalImpulse;
                           const iy = launchDirY * totalImpulse;
                           
                           // Impulse = F * dt
                           const dt = 0.016;
                           turret.applyForce(ix / dt, iy / dt);
                      }

                      if (destroyed) {
                          toDestroy.push({ turret, planet });
                      }
                  }
              }
          });
      });

      toDestroy.forEach(({ turret, planet }) => {
            const tx = turret.position.x;
            const ty = turret.position.y;
            planet.removeTurret(turret);
            this.createExplosion(tx, ty, 0xffaa00, 30);
      });
  }

  public createExplosion(x: number, y: number, color: number, radius: number = 15) {
      FXManager.getInstance().createExplosion(x, y, color, radius);
  }
}
