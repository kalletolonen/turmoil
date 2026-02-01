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
                           
                           const baseForce = 2 * turret.getMass(); // Lower base force
                           const force = (baseForce + pushForce * turret.getMass()) * intensity;
                           
                           const angle = Math.atan2(turret.position.y - y, turret.position.x - x);
                           const ix = Math.cos(angle) * force;
                           const iy = Math.sin(angle) * force;
                           
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
            const tIndex = planet.turretsList.indexOf(turret);
            if (tIndex > -1) {
                planet.turretsList.splice(tIndex, 1);
                const tx = turret.position.x;
                const ty = turret.position.y;
                turret.destroy();
                this.createExplosion(tx, ty, 0xffaa00, 30);
            }
      });
  }

  public createExplosion(x: number, y: number, color: number, radius: number = 15) {
      FXManager.getInstance().createExplosion(x, y, color, radius);
  }
}
