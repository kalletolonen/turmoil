// Mock Canvas getContext for Phaser
HTMLCanvasElement.prototype.getContext = (() => {
  return {
    fillStyle: '',
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: new Array(100) }),
    putImageData: () => {},
    createImageData: () => ([]),
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  };
}) as any;

// Mock AudioContext
(global as any).AudioContext = class {
    createGain() { return { connect: () => {}, gain: { value: 0 } }; }
    createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {} }; }
    destination = {};
};
