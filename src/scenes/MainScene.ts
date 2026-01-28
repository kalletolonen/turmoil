import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import { TurnManager, TurnPhase } from '../logic/TurnManager';
import { FleetRenderer } from '../renderer/FleetRenderer';
import { SeededRNG } from '../logic/SeededRNG';
import { Planet } from '../objects/Planet';
import { Debris } from '../objects/Debris';
import { Projectile } from '../objects/Projectile';
import { Turret } from '../objects/Turret';
import { GravitySystem } from '../logic/GravitySystem';
import { TeamManager } from '../logic/TeamManager';
import { AIManager } from '../logic/AIManager';
import { ProjectileType, PROJECTILE_DATA } from '../objects/ProjectileTypes';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../input/InputManager';
import { TrajectorySystem } from '../logic/TrajectorySystem';
import { FXManager } from '../logic/FXManager';
import { GameConfig } from '../config';
import { MapGenerator } from '../logic/MapGenerator';

export class MainScene extends Phaser.Scene {
  public rapierManager: RapierManager;
  public teamManager: TeamManager;
  public aiManager: AIManager;
  public turnManager: TurnManager;
  private fleetRenderer!: FleetRenderer;
  private rng: SeededRNG;
  public planets: Planet[] = [];
  private debris: Debris[] = [];
  private initialized = false;
  private graphics!: Phaser.GameObjects.Graphics;
  private projectiles: Projectile[] = [];
  
  
  public selectedTurret: Turret | null = null;
  
  public isDevMode: boolean = true;
  public showAITrajectories: boolean = false;
  
  
  public uiManager!: UIManager;
  public inputManager!: InputManager;
  public trajectorySystem!: TrajectorySystem;

  constructor() {
    super('MainScene');
    this.rapierManager = RapierManager.getInstance();
    this.teamManager = new TeamManager();
    this.aiManager = new AIManager();
    this.turnManager = new TurnManager();
    this.rng = new SeededRNG(GameConfig.SEED);
  }

  preload() {
    // Assets would go here
  }

  async create() {
    // 1. Init Physics
    await this.rapierManager.init();
    
    // 2. Setup Renderer
    // 2. Setup Renderer
    this.fleetRenderer = new FleetRenderer(this); // Pass 'this' as scene
    this.graphics = this.add.graphics();
    this.graphics.setDepth(1000);
    
    // ...

    this.uiManager = new UIManager(this);
    this.uiManager.createWeaponSelectionUI();
    this.uiManager.createDebugUI();
    
    // 3. Init AI Physics (after Rapier is ready)
    this.aiManager.init();

    // Generate all textures
    this.generateTextures();
    
    // Init FXManager
    FXManager.init(this);

    // 3. Create Debug Bodies (Visual Test)
    if (this.rapierManager.world) {

        // Initialize Teams
        const redTeam = this.teamManager.addTeam({ id: 'red', name: 'Red Faction', color: 0xff0000 });
        const greenTeam = this.teamManager.addTeam({ id: 'green', name: 'Green Faction', color: 0x00ff00, isAI: true });

        // Spawn Planets with Overlap Prevention
        // Generate Map
        const mapGen = new MapGenerator();
        const mapData = mapGen.generate({
            width: 800,
            height: 600,
            planetCount: 6,
            minPlanetRadius: 25,
            maxPlanetRadius: 70,
            padding: 120
        }, this.rng);

        mapData.planets.forEach((pData) => {
             const planet = new Planet(this, pData.x, pData.y, pData.radius, pData.color, pData.teamId);
             
             if (pData.teamId === redTeam.id) redTeam.addPlanet(planet);
             if (pData.teamId === greenTeam.id) greenTeam.addPlanet(planet);

             if (pData.turretCount > 0) {
                 planet.spawnTurrets(this.rng, pData.turretCount); // MainScene RNG is synced
             }
             this.planets.push(planet);
        });

        // Spawn Debris
        // for (let i = 0; i < 20; i++) {
        //     const x = this.rng.nextRange(50, 750);
        //     const y = this.rng.nextRange(50, 550);
        //     const radius = this.rng.nextRange(3, 8);
        //     this.debris.push(new Debris(this, x, y, radius));
        // }
    }


    this.turnManager.onPhaseChange = (phase) => {
        // UI Update could happen here
        this.add.text(10, 10, `Phase: ${phase}`, { color: '#0f0' })
            .setName('phaseTextTemp')
            .setDepth(100)
            .setScrollFactor(0)
            .destroy(); 

        if (phase === TurnPhase.PLANNING) {
            this.teamManager.resetResources(); // Kept for AI logic? Or remove entirely?
            // User requested "omit faction energy". So we should ignore resources.
            // But AI might use it? Assuming I need to check AI logic separately.
            
            this.projectiles.forEach(p => p.destroy());
            this.projectiles = [];
            this.graphics.clear();

            // AP Accumulation Phase
            this.applyAPAccumulation();

            // TRIGGER AI
            // We give it a slight delay so it doesn't happen INSTANTLY after resolution, 
            // but for now synchronous is fine.
            const teams = this.teamManager.getTeams();
            const aiTeams = teams.filter(t => t.isAI);
            const humanTeams = teams.filter(t => !t.isAI);
            
            aiTeams.forEach(aiTeam => {
                this.aiManager.calculateMoves(aiTeam, humanTeams, this.planets);
            });
             // this.updateTeamUI(); // Removed
        }
    };
    
    // UI Text
    this.add.text(10, 10, 'Press SPACE to Execute Turn', { fontSize: '16px', color: '#ffffff' }).setScrollFactor(0);
    this.data.set('phaseText', this.add.text(10, 30, 'Phase: PLANNING', { fontSize: '16px', color: '#00ff00' }).setScrollFactor(0));

     this.initialized = true;

     // Trigger initial state if we missed the event
     if (this.turnManager.currentPhase === TurnPhase.PLANNING) {
          // Re-run the planning setup manually
          this.teamManager.resetResources();
          this.applyAPAccumulation();
          
          const teams = this.teamManager.getTeams();
          const aiTeams = teams.filter(t => t.isAI);
          
          aiTeams.forEach(aiTeam => {
              const enemies = teams.filter(t => t.id !== aiTeam.id);
              this.aiManager.calculateMoves(aiTeam, enemies, this.planets);
          });
           // this.updateTeamUI();
     }

     this.uiManager = new UIManager(this);
     this.uiManager.createWeaponSelectionUI();
     this.uiManager.createDebugUI();
     
     this.inputManager = new InputManager(this);
     this.inputManager.handleInput();
     
     // Handle Audio Context Resume
     this.input.on('pointerdown', () => {
         const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
         if (soundManager.context && soundManager.context.state === 'suspended') {
             soundManager.context.resume();
         }
     });

     this.trajectorySystem = new TrajectorySystem(this);
  }

  update(_time: number, delta: number) {
    if (!this.initialized) return;

    // Convert delta to ms
    const shouldStep = this.turnManager.update(delta);

    if (shouldStep) {
        GravitySystem.applyGravity(this.projectiles, this.planets);

        // Apply gravity to falling turrets
        const fallingTurrets: Turret[] = [];
        this.planets.forEach(p => {
             p.turretsList.forEach(t => {
                 if (t.isFalling) fallingTurrets.push(t);
             });
        });
        if (fallingTurrets.length > 0) {
            GravitySystem.applyGravity(fallingTurrets, this.planets);
            fallingTurrets.forEach(t => t.update());
        }

        this.rapierManager.step();
        this.projectiles.forEach(p => p.update(this.planets));
    }

    if (this.turnManager.currentPhase === TurnPhase.PLANNING) {
        this.uiManager.updateWeaponSelectionUI();
    }


    // Update Renderer
    const bodies = this.rapierManager.getAllBodyData();
    this.fleetRenderer.update(bodies);
    
    // Update Debris visuals
    this.debris.forEach(d => d.update());

    // List of pending destruction tasks
    const pendingDestruction: (() => void)[] = [];

    // Update FX
    FXManager.getInstance().update(delta);

    // Handle Collisions
    this.rapierManager.drainCollisionEvents((handle1, handle2, started) => {
        if (!started) return;
        // console.log(`Collision Detected: ${handle1} <-> ${handle2}`);

        // Find bodies by handle
        // Rapier events return collider handles
        const collider1 = this.rapierManager.world?.getCollider(handle1);
        const collider2 = this.rapierManager.world?.getCollider(handle2);

        if (!collider1 || !collider2) {
             console.log("Could not find colliders for handles:", handle1, handle2);
             return;
        }
        
        const body1 = collider1.parent();
        const body2 = collider2.parent();

        if (!body1 || !body2) {
            console.log("Colliders have no parent bodies");
            return;
        }

        const data1 = (body1 as any).userData;
        const data2 = (body2 as any).userData;
        
        // console.log("Collision userData:", data1, data2);

        // Check Collision Types
        
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

        // 4. Turret vs Planet (Landing)
        else if ((data1?.type === 'turret' && data2?.type === 'planet') || 
                 (data2?.type === 'turret' && data1?.type === 'planet')) {
            
            const tBody = data1.type === 'turret' ? body1 : body2;
            const pBody = data1.type === 'planet' ? body1 : body2;
            
            const turret = (tBody as any).userData.parent as Turret;
            const planet = (pBody as any).userData.parent as Planet;

            if (turret && turret.isFalling) {
                // Land the turret
                turret.setFalling(false);
                
                // Align rotation to gravity/surface normal?
                // For now, calculating angle from heavy center is a decent approx
                const angle = Math.atan2(turret.position.y - planet.position.y, turret.position.x - planet.position.x);
                // Turret rotation is usually tangent? Or up?
                // Constructor: `new Turret(..., angle)`
                // If angle is the spawn angle, `this.visual.setRotation(angle)`.
                // If it is the rotation on surface, it matches "up" vector + 90 deg usually or just the angle parameter passed to `setRotation`.
                
                // Wait, in `Turret.ts`: `setRotation(angle)`. The sprite is `turret_base`.
                // Usually sprites are right-facing.
                // It relies on how `Planet.spawnTurrets` does it.
                // `const angle = ...; ... new Turret(..., angle ... )`.
                // So expected `rotation` is the angle from planet center.
                // Rapier rotation? `setRotation(angle)`.
                
                // So we should update rotation to `angle`.
                // But `setFalling(false)` makes it fixed. We can set rotation.
                // NOTE: `turret.body` is now Fixed. We can iterate it.
                // We should add a method `turret.land(angle)` or just do it here.
                // Accessing private body is via `turret.position` / `rotation`.
                
                // We can't set rotation easily on Turret without a setter or accessing Rapier body directly (which we have in data1/data2?).
                // `tBody.setRotation(angle)` works.
                tBody.setRotation(angle, true);
                
                // Also update visual immediately? `Turret` updates visual in its own update?
                // `Turret` doesn't have an `update()` method in `Turret.ts`, it just relies on initial setup + manually updating?
                // Wait, `Turret.ts` doesn't have an `update()`.
                // So the visual sprite will NOT follow the physics body if it moves!
                // Major discovery: `Turret` lacks a sync method for Visual -> Physics Body if body moves.
                // If it was Static/Fixed, it never moved, so it was fine.
                // Now that it moves, we MUST add an `update()` method to `Turret` to sync Sprite to Body.
            }
        }
    });

    // Execute pending destructions
    pendingDestruction.forEach(fn => fn());
    
    // Prediction handling during PLANNING
    if (this.turnManager.currentPhase === TurnPhase.PLANNING) {
        this.graphics.clear();
        
        this.trajectorySystem.predictTrajectory(this.graphics);
    }
    
    // Update Phase Text
    const phaseText = this.data.get('phaseText') as Phaser.GameObjects.Text;
    if (phaseText) {
        phaseText.setText(`Phase: ${this.turnManager.currentPhase}`);
    }
  }

  private handleProjectileHitTurret(projectileBody: any, turretBody: any) {
      const projParams = projectileBody.userData;
      const projectileVisual = projParams.visual as Projectile;
      
      if (projectileVisual) {
          // Visuals
          const team = this.teamManager.getTeam(projectileVisual.teamId || '');
          const color = team ? team.color : 0xffffff;
          this.createExplosion(projectileVisual.x, projectileVisual.y, color);

          // Apply Radial Damage
          const stats = PROJECTILE_DATA[projectileVisual.projectileType];
          const radius = stats ? stats.explosionRadius : 15;
          const damage = projectileVisual.damage; 
          
          this.applyRadialDamage(projectileVisual.x, projectileVisual.y, radius, damage);

          // Determine location for ground damage
          // Default to projectile position
          let shockX = projectileVisual.x;
          let shockY = projectileVisual.y;

          // Try to use turret position if available (ensures ground hit)
          const targetTurret = turretBody.userData?.parent as Turret;
          if (targetTurret && targetTurret.position) {
               shockX = targetTurret.position.x;
               shockY = targetTurret.position.y;
          }

          // Also damage the ground (Planet) explicitly
          let closestPlanet: Planet | null = null;
          let minDist = Infinity;
          for (const planet of this.planets) {
              const dist = Phaser.Math.Distance.Between(shockX, shockY, planet.position.x, planet.position.y);
              if (dist < minDist) {
                  minDist = dist;
                  closestPlanet = planet;
              }
          }
          
          if (closestPlanet) {
              closestPlanet.takeDamage(shockX, shockY, radius);
          }

          projectileVisual.destroy();
          this.removeProjectile(projectileVisual);
      }
  }

  private handleProjectileHitPlanet(projectileBody: any) {
      const projParams = projectileBody.userData;
      const projectileVisual = projParams.visual as Projectile;
      
      if (projectileVisual) {
          const team = this.teamManager.getTeam(projectileVisual.teamId || '');
          const color = team ? team.color : 0xffffff;
          
          // Use FX Manager for visual explosion
          FXManager.getInstance().createExplosion(projectileVisual.x, projectileVisual.y, color);
          
          // Check if we hit a planet
          const hitPlanet = this.planets.find(p => p.id === (projectileBody?.userData?.parent as Planet)?.id) || 
                            this.planets.find(p => Phaser.Math.Distance.Between(projectileVisual.x, projectileVisual.y, p.position.x, p.position.y) < p.radiusValue + 20); // Fallback

          if (hitPlanet) {
              const stats = PROJECTILE_DATA[projectileVisual.projectileType];
              const radius = stats ? stats.explosionRadius : 15;
              
              if (radius > 0) {
                 hitPlanet.takeDamage(projectileVisual.x, projectileVisual.y, radius);
                 // Apply Radial Damage to nearby turrets
                 this.applyRadialDamage(projectileVisual.x, projectileVisual.y, radius, projectileVisual.damage);
              }
          }

          // Colonizer Effect
          if (projectileVisual.projectileType === ProjectileType.COLONIZER && hitPlanet) {
              // Calculate angle from planet center to impact point
              const angle = Math.atan2(projectileVisual.y - hitPlanet.position.y, projectileVisual.x - hitPlanet.position.x);
              hitPlanet.addTurretAtAngle(angle, projectileVisual.teamId);
          }

          projectileVisual.destroy();
          this.removeProjectile(projectileVisual);
      }
  }

  private handleProjectileHitProjectile(body1: any, body2: any) {
      const p1 = body1.userData.visual as Projectile;
      const p2 = body2.userData.visual as Projectile;
      
      if (p1) {
          const team = this.teamManager.getTeam(p1.teamId || '');
          const color = team ? team.color : 0xffffff;
          this.createExplosion(p1.x, p1.y, color);
          
          const stats = PROJECTILE_DATA[p1.projectileType];
          this.applyRadialDamage(p1.x, p1.y, stats.explosionRadius, p1.damage);

          p1.destroy();
          this.removeProjectile(p1);
      }
      if (p2) {
          const team = this.teamManager.getTeam(p2.teamId || '');
          const color = team ? team.color : 0xffffff;
          this.createExplosion(p2.x, p2.y, color);

          const stats = PROJECTILE_DATA[p2.projectileType];
          this.applyRadialDamage(p2.x, p2.y, stats.explosionRadius, p2.damage); // P2 also explodes? Double damage? Should probably only one explode?
          // Consistency: both explode.

          p2.destroy();
          this.removeProjectile(p2);
      }
  }

  private applyRadialDamage(x: number, y: number, radius: number, maxDamage: number) {
        if (maxDamage <= 0 || radius <= 0) return;

        const toDestroy: { turret: Turret, planet: Planet }[] = [];

        this.planets.forEach(planet => {
             planet.turretsList.forEach(turret => {
                const dist = Phaser.Math.Distance.Between(x, y, turret.position.x, turret.position.y);
                if (dist <= radius) {
                    // Linear falloff: Max at 0, 0 at radius
                    const damage = Math.floor(maxDamage * (1 - dist / radius));
                    if (damage > 0) {
                        const destroyed = turret.takeDamage(damage);
                        
                        // Apply Kinetic Blast Impulse
                        // Make sure turret is dynamic (falling) if it survives but gets hit hard?
                        // If we want it to fly off, it MUST be set to falling (dynamic)
                        // Threshold for "blasting off": if damage > 10% of max health? 
                        // Or just always if near? if dist/radius < 0.5?
                        
                        // For now, let's say if it takes ANY damage from an explosion, and the ground is somewhat shaky, we might knock it loose.
                        // But strictly: if the ground is destroyed, it falls.
                        // "Blasted off" implies it flies UP or AWAY.
                        
                        // If we want "Blasted off", we should force it to fall (Dynamic) and apply impulse.
                        // But we only want this if the ground is NOT supporting it effectively?
                        // Or if the blast is strong enough to rip it off the foundation.
                        
                        // Let's implement: If damage > 20, force fall and apply impulse.
                        if (damage > 20 && !turret.isFalling) {
                             turret.setFalling(true);
                        }

                        if (turret.isFalling) {
                             // Apply Impulse away from explosion
                             const angle = Math.atan2(turret.position.y - y, turret.position.x - x);
                             const force = 5 * turret.getMass(); // Tune this!
                             const ix = Math.cos(angle) * force;
                             const iy = Math.sin(angle) * force;
                             turret.applyForce(ix, iy); // applyForce uses applyImpulse with scaling?
                             
                             // Turret.applyForce scales by 0.016. so we need to compensate or fix Turret.applyForce.
                             // Proj.applyForce uses addForce? No, applyImpulse.
                             
                             // Let's bypass Turret.applyForce and use body directly if we want pure impulse control?
                             // Or fix Turret.applyForce to NOT scale if we mean impulse?
                             // GravitySystem sends Force. Turret.applyForce converts F -> Impulse for dt=0.016.
                             // Here we want Impulse.
                             // So if we assume applyForce expects Force, then Impulse = F * dt.
                             // We want to deliver specific Impulse J.
                             // So F = J / dt.
                             // So pass J / 0.016 to applyForce.
                             
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
  
  private createExplosion(x: number, y: number, color: number, radius: number = 15) {
      // Visual Explosion (Sprite)
      const circle = this.add.image(x, y, 'particle');
      circle.setTint(color);
      circle.setDepth(2000);
      
      const targetScale = radius / 4; // Base 8x8 -> radius 4. 
      circle.setScale(0.1);

      this.tweens.add({
          targets: circle,
          scale: targetScale,
          alpha: 0,
          duration: 300,
          onComplete: () => circle.destroy()
      });
  }
  
  private removeProjectile(p: Projectile) {
        const pIndex = this.projectiles.indexOf(p);
        if (pIndex > -1) this.projectiles.splice(pIndex, 1);
  }


  
  public fireProjectiles() {
       this.planets.forEach(p => {
         p.turretsList.forEach(t => {
             if (t.armed && t.aimVector) {
                 const angle = Math.atan2(t.aimVector.y, t.aimVector.x);
                 const speed = Math.sqrt(t.aimVector.x * t.aimVector.x + t.aimVector.y * t.aimVector.y);
                 
                 const pos = t.position;
                 const tipLen = 15;
                  const tipX = pos.x + Math.cos(angle) * tipLen;
                  const tipY = pos.y + Math.sin(angle) * tipLen;
                  
                  const proj = new Projectile(this, tipX, tipY, angle, speed, undefined, t.projectileType, t.teamId);
                  if (t.teamId) {
                     // Color projectile based on team if we want?
                     // proj.setTint ...
                     const team = this.teamManager.getTeam(t.teamId);
                     if (team) proj.setTint(team.color);
                 }
                 this.projectiles.push(proj);
             }
         });
     });
  }





  private generateTextures() {
      // 1. Projectile (16x16 Yellow Circle)
      if (!this.textures.exists('projectile')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffff00);
          g.fillCircle(8, 8, 5);
          g.generateTexture('projectile', 16, 16);
          g.destroy();
      }

      // 2. Ship (32x32 Green Triangle)
      if (!this.textures.exists('ship')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.lineStyle(2, 0x00ff00);
          g.fillStyle(0x000000);
          
          g.beginPath();
          g.moveTo(16, 6);   // Top (shifted relative to center)
          g.lineTo(24, 26);  // Bottom Right
          g.lineTo(16, 22);  // Bottom Center (notch)
          g.lineTo(8, 26);   // Bottom Left
          g.closePath();
          
          g.fillPath();
          g.strokePath();
          
          g.generateTexture('ship', 32, 32);
          g.destroy();
      }

      // 3. Turret Base (32x32 White Box)
      if (!this.textures.exists('turret_base')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillRect(6, 6, 20, 20);
          g.generateTexture('turret_base', 32, 32);
          g.destroy();
      }

      // 4. Debris (16x16 Grey Circle)
      if (!this.textures.exists('debris')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0x888888);
          g.fillCircle(8, 8, 5);
          g.generateTexture('debris', 16, 16);
          g.destroy();
      }

      // 5. Particle (8x8 White Circle)
      if (!this.textures.exists('particle')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillCircle(4, 4, 3);
          g.generateTexture('particle', 8, 8);
          g.destroy();
      }

      // 6. 1x1 White Pixel
      if (!this.textures.exists('white_1x1')) {
          const g = this.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillRect(0, 0, 1, 1);
          g.generateTexture('white_1x1', 1, 1);
          g.destroy();
      }
  }

  private applyAPAccumulation() {
      this.planets.forEach(p => {
          const controllerId = p.getControllerTeamId();
          p.turretsList.forEach(t => {
              let apGain = 1;
              if (controllerId && t.teamId === controllerId) {
                  apGain = 2;
              }
              t.addActionPoints(apGain);

               // Visual Feedback
              const text = `+${apGain}`;
              // Green for player/friendly, maybe different for enemy?
              // For now simpler: Cyan for AP.
              FXManager.getInstance().showFloatingText(t.position.x, t.position.y - 20, text, '#00ffff');

              // If Red Faction Max AP config is enabled, max it out
              if (GameConfig.RED_FACTION_MAX_AP && t.teamId === 'red') {
                  t.setMaxActionPoints();
              }
          });
      });
  }
}
