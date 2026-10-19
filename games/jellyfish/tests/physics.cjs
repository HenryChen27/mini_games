// Run with: node tests/physics.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Matter = require('../js/matter.min.js');
const root = path.join(__dirname, '..');

function game(physicsOverrides={},mergeEnabled=true) {
  let now = 1;
  const context = vm.createContext({
    planck: require('../js/planck.min.js'), Matter, console, performance: { now: () => now },
    window: {},
    SessionSave: { write: () => true, clear() {} },
    queueMicrotask: fn => fn(),
    document: { readyState: 'loading', addEventListener() {} },
    requestAnimationFrame() {},
    setTimeout() {},
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), context);
  vm.runInContext(`Object.assign(CONFIG.PHYSICS, ${JSON.stringify(physicsOverrides)})`,context);
  vm.runInContext(fs.readFileSync(path.join(root,'js/native-physics.js'),'utf8'),context);
  // Expose closure internals only in this test, and skip canvas drawing.
  const source = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8')
    .replace('render(timestamp);', '')
    .replace('    triggerMerge(ba, bb);',mergeEnabled?'    triggerMerge(ba, bb);':'')
    .replace('      checkGameOver();',mergeEnabled?'      checkGameOver();':'')
    .replace('  // --- Start ---', `
      globalThis.testGame = { G, initPhysics, setupCollisionHandler,
        createJellyfishBody, addJellyfishItem, triggerMerge, dropJellyfish, spawnRandomJellyfish, loop, drawJellyfish };
      // --- Start ---`);
  vm.runInContext(source, context);
  const api = context.testGame;
  api.initPhysics();
  api.setupCollisionHandler();
  api.G.assets = { images: {}, audio: {} };
  api.G.phase = 'playing';
  api.add = (x, y, level) => {
    const body = api.createJellyfishBody(x, y, level);
    const item = api.addJellyfishItem(body, level);
    Matter.Composite.add(api.G.engine.world, body);
    item.bodyInWorld = true;
    return item;
  };
  api.advance = (seconds, fps) => {
    for (let i = 0; i < Math.round(seconds * fps); i++) {
      now += 1000 / fps;
      api.loop(now);
      if(api.checkBoundary)api.checkBoundary();
    }
  };
  return api;
}



{
 const api=game();
 const layout=[[9,1200,1234,0],[9,1477,751,.7],[8,1014,970,0],[7,1642,1156,-.2],
 [6,1650,961,.1],[6,1477,1317,.2],[6,1372,999,.4],[3,1231,937,.5],[3,1699,814,-.2],[3,1512,1053,.2],
 [4,1459,1156,.2],[4,880,796,0],[4,970,1288,0],[4,1695,1314,0],[5,893,1170,0],
 [2,1011,1392,1.55],[2,1596,1392,1.5],[2,960,1365,1.6],[3,861,1359,0],[1,1743,1391,0],[1,1006,1393,0],[1,1743,884,0]];
 for(const [level,x,y,angle] of layout){const i=api.add(x,y,level);Matter.Body.setAngle(i.body,angle);}
 api.advance(30,120);
 console.log('Screenshot pile awake:',api.G.items.filter(i=>!i.body.isSleeping).map(i=>[i.level,i.body.speed,i.body.angularSpeed,i.body.motion]));
 const poses=api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle]));api.advance(3,120);
 assert.deepEqual(api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle])),poses,'screenshot pile must stop moving');
 const fallen=api.add(1100,350,2);api.advance(.5,120);
 assert.ok(fallen.body.position.y>350,'unsupported fish must fall');
 api.advance(20,120);
 const after=api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle]));
 api.advance(5,120);
 assert.deepEqual(api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle])),after,'disturbed screenshot pile must settle again');

}

{
 const api=game();
 api.spawnRandomJellyfish(10);api.advance(1,120);api.spawnRandomJellyfish(10);
 api.advance(30,120);
 const poses=api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle]));
 api.advance(5,120);
 assert.deepEqual(api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle])),poses,'C-key pile must stop moving');
 console.log('C-key repeated spawning: settles and stays still');
}

// Isolate contact stability with 60 bodies, so merges cannot hide the
// number of contacts. Overflow scoring is excluded only in this physics test.
for(const backend of ['matter','planck']) {
 const api=game({backend},false);
 for(let row=0;row<6;row++)for(let col=0;col<10;col++) {
   const item=api.add(860+col*94,1280-row*120,1+(col+row*3)%5);
   Matter.Body.setAngle(item.body,(col%3-.5)*.3);
 }
 api.advance(40,120);
 const before=api.G.items.map(i=>({x:i.body.position.x,y:i.body.position.y,angle:i.body.angle}));
 api.advance(10,120);
 const drift=Math.max(...api.G.items.map((item,i)=>Math.hypot(item.body.position.x-before[i].x,item.body.position.y-before[i].y)));
 const turn=Math.max(...api.G.items.map((item,i)=>Math.abs(item.body.angle-before[i].angle)));
 console.log(`60-body ${backend}: awake=${api.G.items.filter(i=>!i.body.isSleeping).length}, drift=${drift.toFixed(4)}px, turn=${turn.toFixed(4)}rad`);
 if(backend==='planck') {
   assert.equal(drift,0,'native dense pile must stay still');assert.equal(turn,0);
   const driver=api.G.items.find(i=>i.level===5);Matter.Sleeping.set(driver.body,false);Matter.Body.setAngularVelocity(driver.body,.12);
   let settled=0;
   do {api.advance(.25,120);settled+=.25;} while(settled<10 && api.G.items.some(i=>!i.body.isSleeping));
   assert.ok(api.G.items.every(i=>i.body.isSleeping),'spin impulse must settle within ten seconds');
   console.log('60-body spin impulse settled after',settled,'seconds');
   const poses=api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle]));api.advance(5,120);
   assert.deepEqual(api.G.items.map(i=>JSON.stringify([i.body.position,i.body.angle])),poses,'dense pile must settle after spin impulse');
 }
}

for (const merge of [false, true, 'floor']) {
  const api = game();
  const sounds = [];
  for (const key of ['click', 'form1', 'form2']) {
    api.G.assets.audio[key] = { cloneNode: () => ({ play: () => {
      sounds.push(key); return Promise.resolve();
    } }) };
  }
  if (merge !== 'floor') api.add(1100, 1300, merge ? 2 : 4);
  api.G.dropLevel = 2;
  api.G.clipX = 1100;
  api.dropJellyfish();
  api.advance(8, 60);
  assert.deepEqual(sounds, ['click', merge === true ? 'form2' : 'form1']);
  console.log(merge === 'floor' ? 'Drop: first floor contact plays form1 once'
    : merge ? 'Drop: click then merge sound' : 'Drop: click then non-merge form1 once');
}

for (const fps of [30, 60, 120, 144]) {
  const api = game();
  const items = [api.add(1292, 1150, 10), api.add(1292, 700, 9), api.add(1292, 300, 8)];
  api.advance(15, fps);
  assert.equal(api.G.phase, 'playing');
  assert.ok(items.every(item => item.body.isSleeping), `${fps}fps stack must sleep`);
  const poses = items.map(item => JSON.stringify([item.body.position, item.body.angle]));
  api.advance(3, fps);
  assert.deepEqual(items.map(item => JSON.stringify([item.body.position, item.body.angle])), poses);
  const top = items[2];
  api.add(top.body.position.x, top.body.position.y - 250, 1);
  let woke = false;
  Matter.Events.on(top.body, 'sleepEnd', () => { woke = true; });
  api.advance(2, fps);
  assert.ok(woke, 'new impacts must wake the stack');
  console.log(`${fps}fps: stack settles, remains still, and wakes on impact`);
}

{
  const api = game();
  const layout = [
    [880, 1340, 4, 0], [915, 1190, 3, 0], [1045, 1310, 6, 0],
    [1250, 1250, 7, 0.5], [1225, 1380, 1, 0], [1310, 1380, 2, 1.5],
    [1430, 1340, 3, 0], [1525, 1380, 1, 0], [1640, 1280, 7, 0],
    [1735, 1380, 1, 0],
  ];
  for (const [x, y, level, angle] of layout) {
    const item = api.add(x, y, level);
    Matter.Body.setAngle(item.body, angle);
  }
  api.advance(20, 60);
  assert.ok(api.G.items.every(i => i.body.isSleeping), 'recording-like mixed pile must settle');
  const poses = api.G.items.map(i => JSON.stringify([i.body.position, i.body.angle]));
  api.advance(3, 60);
  assert.deepEqual(api.G.items.map(i => JSON.stringify([i.body.position, i.body.angle])), poses);
  console.log('Recording-like mixed pile: sleeps and stays still');
}

{
  const api = game();
  const a = api.add(1100, 1300, 4);
  const b = api.add(1300, 1300, 4);
  const supported = api.add(1200, 1100, 8);
  Matter.Sleeping.set(supported.body, true);
  api.triggerMerge(a.body, b.body);
  assert.equal(supported.body.isSleeping, false, 'merge must wake unsupported bodies');
  api.advance(0.5, 60);
  assert.equal(api.G.merges.length, 0);
  assert.ok(api.G.items.some(item => item.level === 5 && item.bodyInWorld));
  console.log('Merge: wakes support stack and creates the next level');
}

for (let seed = 1; seed <= 12; seed++) {
  const api = game();
  let state = seed;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let n = 0; n < 25; n++) {
    api.add(920 + random() * 730, 350, 1 + Math.floor(random() * 5));
    api.advance(0.5, 60);
  }
  api.advance(20, 60);
  const awake = api.G.items.filter(i => !i.body.isSleeping);
  assert.equal(awake.length, 0, `drop sequence ${seed} must settle`);
  const poses = api.G.items.map(i => JSON.stringify([i.body.position, i.body.angle]));
  api.advance(3, 60);
  assert.deepEqual(api.G.items.map(i => JSON.stringify([i.body.position, i.body.angle])), poses);
  assert.ok(api.G.items.every(i => i.body.position.x >= 811 && i.body.position.x <= 1773
    && i.body.position.y <= 1414), 'fish must remain inside the bin');
  console.log('Drop sequence', seed, ': settled and stationary');
}

// Deep overlaps after a large merge must never push a body through a wall.
for(const side of ['left','right']) {
  const api=game();
  const edge=side==='left'?811:1773;
  const direction=side==='left'?1:-1;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++) {
    api.add(edge+direction*(130+col*175),1280-row*165,8);
  }
  const a=api.add(edge+direction*190,1190,10);
  const b=api.add(edge+direction*210,1170,10);
  api.triggerMerge(a.body,b.body);
  api.checkBoundary=()=>{
    for(const item of api.G.items) {
      if(!item.bodyInWorld || item.isMerging)continue;
      const vertices=item.body.vertices;
      assert.ok(vertices.every(v=>v.x>=810.4&&v.x<=1773.6&&v.y<=1414.6),
        `crowded ${side} merge escaped: level ${item.level}, ${JSON.stringify(item.body.position)}`);
    }
  };
  api.advance(3,120);
  assert.ok(api.G.items.some(i=>i.level===11),'large merge completes');
  console.log(`Crowded ${side} merge: no wall or floor escape`);
}

{
  const api = game();
  const item = api.add(1200, 1300, 11);
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, key) => (...args) => { calls.push([key, ...args]); },
    set: () => true,
  });
  api.drawJellyfish(ctx, item);
  api.advance(0.1, 144);
  item.previousPose = { x: item.body.position.x, y: item.body.position.y, angle: item.body.angle };
  calls.length = 0;
  api.drawJellyfish(ctx, item);
  assert.deepEqual(calls.find(call => call[0] === 'translate'), ['translate', item.body.position.x, item.body.position.y]);
  assert.deepEqual(calls.find(call => call[0] === 'scale'), ['scale', 1, 1]);
  item.previousPose = { x: 1000, y: 1000, angle: 0 };
  api.G.physicsAccumulator = (1000 / 120) / 2;
  calls.length = 0;
  api.drawJellyfish(ctx, item);
  assert.deepEqual(calls.find(call => call[0] === 'translate'),
    ['translate', (1000 + item.body.position.x) / 2, (1000 + item.body.position.y) / 2]);
  console.log('Render: no artificial bobbing or scale pulse');
}
