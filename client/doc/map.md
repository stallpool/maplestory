# component

- /Map.wz/Map/Map[areaId]/xxxxxxxxx.img: map assembly metadata
- mapAssemblyMetadata = { info, back, life, reactor, seat, foothold, ladderRope, portal, miniMap, `number`, `flag` }
   - info = { version, cloud, town, returnMap, forcedReturn, mobRate, bgm, mapMark, hideMinimap, fieldLimit, `flag` }
      - `flag`: e.g. `link: yyyyyyyyy`
   - back = [ { bS, front, ani, no, x, y, rx, ry, type, cx, cy } ] ---> e.g. `bS=skyStation`
   - life = [ { type, id, x, y, mobTime, f, hide, fh, cy, rx0, rx1 } ] ---> e.g. `type=n, id=2010006`
   - reactor = [ { id, x, y, reactorTime, f, name } ]
   - seat = [ { x, y } ]
   - foothold = [ [{x, y} polygon] ]
   - ladderRope = [ { l, uf, x, y1, y2, page } ]
   - portal = [ { x, y, pn, pm, tn, tm } ]
   - miniMap = { canvas, width, height, centerX, centerY, mag }
   - `number` = { info, tile, obj }
      - info = { tS, tSMag } ---> e.g. `tS=dryRock2`
      - tile = { `number`: { x, y, u, no, zM } } ---> e.g. `u=enV1`
      - obj = { `number`: { oS, l0, l1, l2, x, y, z, f, zM } } ---> e.g. `oS=houseSS, [l0,l1,l2]=[house4,basic,0]`
   - `flag`: e.g. `swimArea: ...`
