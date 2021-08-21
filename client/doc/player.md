# component

- /Character.wz/0000xxxx.img/`type`: bodyData
- /Character.wz/0001xxxx.img/`type`/head: headData
- `type` = stand, walk, prone, ...
- bodyData, headData = [ `number`, ... ], where `number` is animationFrame id
- animationFrame = { origin, map, z, group }
   - origin: rotation center x, y
   - map: { `component`: { x, y } }, e.g. `neck: { x: 0, y: 15 }`
   - z: `z-index`
- component connection:
   - A: { origin, map[conn] }, B: { origin, map[conn] }
   - assume draw A at (Xa, Ya)
   - `Xb = Xa + (A.origin.x + A.map[conn].x) - (B.origin.x + B.map[conn].x)`
   - `Yb = Ya + (A.origin.y + A.map[conn].y) - (B.origin.y + B.map[conn].y)`

# z-index

- body: 0
- armOverHair: 4
- handOverHair: 6
- head: 8
- face: 12
- arm: 15
- handBelowWeapon: 20
- backHead: 50

