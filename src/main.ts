
// Debug: Intercept warnings to trace their source
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args.some(arg => typeof arg === 'string' && (arg.includes('WebGL') || arg.includes('texImage')))) {
        console.trace('Tracing WebGL Warning:', ...args);
    }
    originalWarn(...args);
};

import { MainScene } from './scenes/MainScene';
import { UIScene } from './scenes/UIScene';
import { MenuScene } from './scenes/MenuScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  physics: {
    default: 'none', // We are using Rapier manually
  },
  scene: [MenuScene, MainScene, UIScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  dom: {
      createContainer: true
  }
};

new Phaser.Game(config);
