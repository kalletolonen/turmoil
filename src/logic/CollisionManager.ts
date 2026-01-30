import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import { Projectile } from '../objects/Projectile';
import { Turret } from '../objects/Turret';
import { Planet } from '../objects/Planet';
import { CombatManager } from './CombatManager';
import { TeamManager } from './TeamManager';
import { FXManager } from './FXManager';
import { ProjectileType, PROJECTILE_DATA } from '../objects/ProjectileTypes';
import RAPIER from '@dimforge/rapier2d-compat';

export class CollisionManager {
  private rapierManager: RapierManager;
  
  constructor(
      private combatManager: CombatManager,
      private teamManager: TeamManager,
      private getPlanets: () => Planet[],
      private removeProjectile: (p: Projectile) => void
  ) {
      this.rapierManager = RapierManager.getInstance();
  }

  public update() {
      // List of pending destruction tasks
      const pendingDestruction: (() => void)[] = [];

      this.rapierManager.drainCollisionEvents((handle1, handle2, started) => {
        if (!started) return;
        
        // Find bodies by handle
        const collider1 = this.rapierManager.world?.getCollider(handle1);
        const collider2 = this.rapierManager.world?.getCollider(handle2);

        if (!collider1 || !collider2) return;
        
        const body1 = collider1.parent();
        const body2 = collider2.parent();

        if (!body1 || !body2) return;

        const data1 = (body1 as any).userData;
        const data2 = (body2 as any).userData;
        
        // 1. Projectile vs Turret
        if ((data1?.type === 'projectile' && data2?.type === 'turret') || 
            (data2?.type === 'projectile' && data1?.type === 'turret')) {
            
            const pBody = data1.type === 'projectile' ? body1 : body2;
            const tBody = data1.type === 'turret' ? body1 : body2;
            
            pendingDestruction.push(() => this.handleProjectileHitTurret(pBody, tBody));
        }
        
        // 2. Projectile vs Planet
        else if ((data1?.type === 'projectile' && data2?.type === 'planet') || 
                 (data2?.type === 'projectile' && data1?.type === 'planet')) {
            
            const pBody = data1.type === 'projectile' ? body1 : body2;
            pendingDestruction.push(() => this.handleProjectileHitPlanet(pBody));
        }
        
        // 3. Projectile vs Projectile
        else if (data1?.type === 'projectile' && data2?.type === 'projectile') {
            pendingDestruction.push(() => this.handleProjectileHitProjectile(body1, body2));
        }

        // 4. Turret vs Turret (Fusion)
        else if (data1?.type === 'turret' && data2?.type === 'turret') {
             const tBody1 = body1;
             const tBody2 = body2;
             const tur1 = (tBody1 as any).userData.parent as Turret;
             const tur2 = (tBody2 as any).userData.parent as Turret;

             // Only fuse if one is falling and the other is stationary (or both falling?)
             // Let's say if A falls onto B, B absorbs A.
             if (tur1.isFalling && !tur2.isFalling) {
                 pendingDestruction.push(() => this.handleTurretFusion(tur2, tur1));
             } else if (!tur1.isFalling && tur2.isFalling) {
                  pendingDestruction.push(() => this.handleTurretFusion(tur1, tur2));
             }
        }

        // 4. Turret vs Planet (Landing)
        else if ((data1?.type === 'turret' && data2?.type === 'planet') || 
                 (data2?.type === 'turret' && data1?.type === 'planet')) {
            
            const tBody = data1.type === 'turret' ? body1 : body2;
            const pBody = data1.type === 'planet' ? body1 : body2;
            
            const turret = (tBody as any).userData.parent as Turret;
            const planet = (pBody as any).userData.parent as Planet;

            if (turret && turret.isFalling) {
                // Check if we should land
                const tVel = (tBody as RAPIER.RigidBody).linvel();
                const dx = turret.position.x - planet.position.x;
                const dy = turret.position.y - planet.position.y;
                
                const dot = tVel.x * dx + tVel.y * dy;
                const speedSq = tVel.x * tVel.x + tVel.y * tVel.y;
                
                if (dot < 0 || speedSq < 1.0) {
                     turret.setFalling(false);
                     
                     // Align rotation to gravity/surface normal
                     const angle = Math.atan2(dy, dx);
                     tBody.setRotation(angle, true);
                }
            }
        }
    });

    // Execute pending destructions
    pendingDestruction.forEach(fn => fn());
  }

  private handleProjectileHitTurret(projectileBody: any, turretBody: any) {
      const projParams = projectileBody.userData;
      const projectileVisual = projParams.visual as Projectile;
      
      if (projectileVisual) {
          // Guard: Prevent double-processing if already handled
          if (projectileVisual.processed) return;
          projectileVisual.processed = true;

          const team = this.teamManager.getTeam(projectileVisual.teamId || '');
          const color = team ? team.color : 0xffffff;
          
          if (projectileVisual.projectileType === ProjectileType.COLONIZER) {
               // Fusion / Landing logic
               const targetTurret = turretBody.userData?.parent as Turret;
               if (targetTurret) {
                   // Find the planet this turret is on
                   const planets = this.getPlanets();
                   const planet = planets.find(p => p.turretsList.includes(targetTurret));
                   
                   if (planet) {
                        const angle = Math.atan2(projectileVisual.y - planet.position.y, projectileVisual.x - planet.position.x);
                        planet.addTurretAtAngle(angle, projectileVisual.teamId);
                   }
               }
               
               projectileVisual.destroy();
               this.removeProjectile(projectileVisual);
               return;
          }

          const stats = PROJECTILE_DATA[projectileVisual.projectileType];
          const radius = stats ? stats.explosionRadius : 15;
          const damage = projectileVisual.damage; 
          
          if (radius > 0) {
              this.combatManager.createExplosion(projectileVisual.x, projectileVisual.y, color);
          } 
          
          // Determine location for ground damage and target turret
          let shockX = projectileVisual.x;
          let shockY = projectileVisual.y;

          const targetTurret = turretBody.userData?.parent as Turret;
          if (targetTurret && targetTurret.position) {
               shockX = targetTurret.position.x;
               shockY = targetTurret.position.y;
          }
           
          // Apply damage AFTER getting position, in case turret gets destroyed
          this.combatManager.applyRadialDamage(projectileVisual.x, projectileVisual.y, radius, damage, this.getPlanets());

          // Also damage the ground (Planet) explicitly
          let closestPlanet: Planet | null = null;
          let minDist = Infinity;
          for (const planet of this.getPlanets()) {
              const dist = Phaser.Math.Distance.Between(shockX, shockY, planet.position.x, planet.position.y);
              if (dist < minDist) {
                  minDist = dist;
                  closestPlanet = planet;
              }
          }
          
          if (closestPlanet && damage > 0) {
              closestPlanet.takeDamage(shockX, shockY, radius);
          }

          projectileVisual.destroy();
          this.removeProjectile(projectileVisual);
      }
  }

  private handleProjectileHitPlanet(projectileBody: any) {
      const projParams = projectileBody.userData;
      const projectileVisual = projParams.visual as Projectile;
      const planets = this.getPlanets();
      
      // Guard: Prevent double-processing if already handled
      if (!projectileVisual || projectileVisual.processed) {
          return;
      }
      projectileVisual.processed = true;
          const team = this.teamManager.getTeam(projectileVisual.teamId || '');
          const color = team ? team.color : 0xffffff;
          
          const stats = PROJECTILE_DATA[projectileVisual.projectileType];
          const radius = stats ? stats.explosionRadius : 15;

          if (radius > 0) {
              FXManager.getInstance().createExplosion(projectileVisual.x, projectileVisual.y, color);
          }
          
          const hitPlanet = planets.find(p => p.id === (projectileBody?.userData?.parent as Planet)?.id) || 
                            planets.find(p => Phaser.Math.Distance.Between(projectileVisual.x, projectileVisual.y, p.position.x, p.position.y) < p.radiusValue + 20); 

          if (hitPlanet) {
              if (radius > 0) {
                 if (projectileVisual.damage > 0) {
                     hitPlanet.takeDamage(projectileVisual.x, projectileVisual.y, radius);
                 }
                 this.combatManager.applyRadialDamage(projectileVisual.x, projectileVisual.y, radius, projectileVisual.damage, planets);
              }
          }

          if (projectileVisual.projectileType === ProjectileType.COLONIZER && hitPlanet) {
              const angle = Math.atan2(projectileVisual.y - hitPlanet.position.y, projectileVisual.x - hitPlanet.position.x);
              hitPlanet.addTurretAtAngle(angle, projectileVisual.teamId);
          }

      projectileVisual.destroy();
      this.removeProjectile(projectileVisual);
  }

  private handleProjectileHitProjectile(body1: any, body2: any) {
      const p1 = body1.userData.visual as Projectile;
      const p2 = body2.userData.visual as Projectile;
      const planets = this.getPlanets();
      
      if (p1) {
          const team = this.teamManager.getTeam(p1.teamId || '');
          const color = team ? team.color : 0xffffff;
          
          const stats = PROJECTILE_DATA[p1.projectileType];
          if (stats.explosionRadius > 0) {
              this.combatManager.createExplosion(p1.x, p1.y, color);
          }
          this.combatManager.applyRadialDamage(p1.x, p1.y, stats.explosionRadius, p1.damage, planets);

          p1.destroy();
          this.removeProjectile(p1);
      }
      if (p2) {
          const team = this.teamManager.getTeam(p2.teamId || '');
          const color = team ? team.color : 0xffffff;
          
          const stats = PROJECTILE_DATA[p2.projectileType];
          if (stats.explosionRadius > 0) {
              this.combatManager.createExplosion(p2.x, p2.y, color);
          }
          this.combatManager.applyRadialDamage(p2.x, p2.y, stats.explosionRadius, p2.damage, planets);

          p2.destroy();
          this.removeProjectile(p2);
      }
  }

  private handleTurretFusion(host: Turret, donor: Turret) {
      if (!host.visual || !donor.visual) return; // Already destroyed?
      if (host.teamId !== donor.teamId) return; // Only fuse same faction

      
      // Transfer stats
      // Increase MAX health and AP first
      host.maxHealth += donor.maxHealth;
      host.maxActionPoints += donor.maxActionPoints;
      
      host.health += donor.health;
      host.actionPoints += donor.actionPoints;
      
      // Visual feedback
      host.visual.setTint(0x00ffff); // Cyan to indicate fusion/upgrade
      // Maybe scale up slightly?
      host.visual.setScale(host.visual.scaleX * 1.2, host.visual.scaleY * 1.2);
      
      FXManager.getInstance().createFloatingText(host.position.x, host.position.y, "FUSION!", 0x00ffff);
      
      host.updateHealthBar();
      
      // Destroy donor
      donor.destroy();
  }
}
