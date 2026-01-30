import Phaser from 'phaser';
import { Planet } from '../objects/Planet';
import { Turret } from '../objects/Turret';
import { FXManager } from './FXManager';

export class CombatManager {
  constructor() {}

  public applyRadialDamage(
    x: number, 
    y: number, 
    radius: number, 
    maxDamage: number, 
    planets: Planet[]
  ) {
      if (maxDamage <= 0 || radius <= 0) return;

      const toDestroy: { turret: Turret, planet: Planet }[] = [];

      planets.forEach(planet => {
           planet.turretsList.forEach(turret => {
              const dist = Phaser.Math.Distance.Between(x, y, turret.position.x, turret.position.y);
              if (dist <= radius) {
                  // Linear falloff: Max at 0, 0 at radius
                  const damage = Math.floor(maxDamage * (1 - dist / radius));
                  if (damage > 0) {
                      const destroyed = turret.takeDamage(damage);
                      
                      // "Blasted off" mechanics
                      if (damage > 20 && !turret.isFalling) {
                           turret.setFalling(true);
                      }

                      if (turret.isFalling) {
                           // Apply Impulse away from explosion
                           const angle = Math.atan2(turret.position.y - y, turret.position.x - x);
                           const force = 5 * turret.getMass(); 
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
