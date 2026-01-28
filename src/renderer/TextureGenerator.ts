import Phaser from 'phaser';

export class TextureGenerator {
  static generate(scene: Phaser.Scene) {
      // 1. Projectile (16x16 Yellow Circle)
      if (!scene.textures.exists('projectile')) {
          const g = scene.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffff00);
          g.fillCircle(8, 8, 5);
          g.generateTexture('projectile', 16, 16);
          g.destroy();
      }

      // 2. Ship (32x32 Green Triangle)
      if (!scene.textures.exists('ship')) {
          const g = scene.make.graphics({ x: 0, y: 0 });
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
      if (!scene.textures.exists('turret_base')) {
          const g = scene.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillRect(6, 6, 20, 20);
          g.generateTexture('turret_base', 32, 32);
          g.destroy();
      }

      // 4. Debris (16x16 Grey Circle)
      if (!scene.textures.exists('debris')) {
          const g = scene.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0x888888);
          g.fillCircle(8, 8, 5);
          g.generateTexture('debris', 16, 16);
          g.destroy();
      }

      // 5. Particle (8x8 White Circle)
      if (!scene.textures.exists('particle')) {
          const g = scene.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillCircle(4, 4, 3);
          g.generateTexture('particle', 8, 8);
          g.destroy();
      }

      // 6. 1x1 White Pixel
      if (!scene.textures.exists('white_1x1')) {
          const g = scene.make.graphics({ x: 0, y: 0 });
          g.fillStyle(0xffffff);
          g.fillRect(0, 0, 1, 1);
          g.generateTexture('white_1x1', 1, 1);
          g.destroy();
      }
  }
}
