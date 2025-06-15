const grid = document.getElementById("grid")

const DIRS = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0]
]

const gridS = 10, normCenter = .6, pCount = 4, minD = .2, maxTries = 1000, maxCross = 0, maxStraight = 3, randomness = .5;

grid.style.gridTemplateColumns = `repeat(${gridS}, 1fr)`
grid.style.gridTemplateRows = `repeat(${gridS}, 1fr)`

for (let i = 0; i < gridS; i++) {
    for (let j = 0; j < gridS; j++) {
        const elm = document.createElement("div")
        elm.classList.add("cell")
        elm.id = `${i}_${j}`

        grid.appendChild(elm)
    }
}

window.addEventListener("click", () => {
    const cells = document.querySelectorAll(".cell")
    cells.forEach((cell) => {
        cell.style.background = "unset"
        cell.innerHTML = ""
    })

    let track, o = 0
    do {
        track = genTrack()
        o++
    } while (track.length <= 0 && o < maxTries)

    track.forEach((cords, i) => {
        const cell = document.getElementById(`${cords[0]}_${cords[1]}`)
        cell.innerHTML = i

        const hue = (360 / track.length) * i

        cell.style.background = `hsl(${hue.toFixed(2)}, 100%, 60%)`
    })

    drawArrows(track)
})

// Priority Queue class
class PriorityQueue {
    constructor() {
        this.elements = []
    }
    
    enqueue(element) {
        this.elements.push(element)
        if (Math.random() > 1-randomness) {
            this.elements = shuffle(this.elements)
        }
        else { 
            this.elements.sort((a, b) => a.dist - b.dist)
        }
    }
    
    dequeue() {
        return this.elements.shift()
    }
    
    isEmpty() {
        return this.elements.length === 0
    }
}

function genTrack() {
    //get key points
    let points = []
    for (let i = 0; i < pCount; i++) {
        points.push(getPoint())
    }

    //get key ring
    let ring = [], o = 0
    while ((!ring || ring.length < pCount) && o < maxTries) {
        ring = genRing(points)
        o++
    }

    //get conncetions
    let connections = closeRing(ring)

    return connections

    //NOTE - Generate Base Points
    function getPoint() {
        const nG = gridS*normCenter
        let x, y, check = false

        //Assure that point is not close to edges or the center
        for (let i = 0; i < maxTries; i++) {
            check = false

            x = Math.floor(Math.random()*nG)
            y = Math.floor(Math.random()*nG)
            x = x > nG/2 ? x + Math.floor(gridS*(1-normCenter)) : x
            y = y > nG/2 ? y + Math.floor(gridS*(1-normCenter)) : y

            points.forEach((point) => {
                if (Math.hypot(point[0] - x, point[1] - y) < gridS*minD) {
                    check = true
                }
            })

            if (!check) break
        }

        return [x, y]
    }

    //NOTE - Generate Ring
    function genRing(points) {

        //Shuffle and count crosses
        for (let i = 0; i < maxTries; i++) {
            let shuffled = shuffle(points)
            let crosses = countCrosses(shuffled)

            if (crosses <= maxCross) return shuffled
        }

        //NOTE - Count Intersection
        function countCrosses(path) {
            let c = 0, n = path.length

            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    let a1 = path[i], a2 = path[(i + 1) % n]
                    let b1 = path[j], b2 = path[(j + 1) % n]

                    if ((i + 1) % n == j || (j + 1) % n == i || i == j) continue
                    if (checkCross(a1, a2, b1, b2)) c++
                }
            }

            return c

            //NOTE - Check Intersection
            function checkCross(p1, p2, p3, p4) {
                return ccw(p1, p3, p4) != ccw(p2, p3, p4) && ccw(p1, p2, p3) != ccw(p1, p2, p4)

                //NOTE - CounterClockWise Algorithm
                function ccw(a, b, c) {
                    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
                }
            }
        }
    }

    //NOTE - Close Ring
    function closeRing(path) {
        const used = Array(gridS).fill().map(() => new Uint8Array(gridS))
        const isTurnTile = Array(gridS).fill().map(() => new Uint8Array(gridS))
        const nearby = getNearby(path)

        let crossesUsed = 0
        const connections = []
    
        for (let i = 0; i < path.length; i++) {
            //Get A* and randomized path for every 2 points
            const a = path[i]
            const b = path[(i + 1) % path.length]
            const seg = getPath(a, b, used, nearby, isTurnTile, crossesUsed)
            
            if (!seg) return [] //Error

            //Save path
            crossesUsed = seg.crossesUsed
            seg.path.forEach((cell) => {
                const [x, y] = cell
                used[x][y]++
                connections.push([x, y])
            })
            seg.turns.forEach(([x, y]) => {
                isTurnTile[x][y] = 1
            })
        }
    
        return connections
    
        //NOTE - GetNearbyCells
        function getNearby(path) {
            const nearby = Array(gridS).fill().map(() => new Uint8Array(gridS))
            
            for (const [x, y] of path) {

                for (let nx = Math.max(0, x-1); nx <= Math.min(gridS-1, x+1); nx++) {
                    for (let ny = Math.max(0, y-1); ny <= Math.min(gridS-1, y+1); ny++) {
                        nearby[nx][ny] = 1
                    }
                }
            }
            return nearby
        }
    
        //NOTE - GetPath Function
        function getPath(a, b, used, nearby, isTurnTile, initialCrosses) {
            const visited = new Set()
            const pq = new PriorityQueue()
            pq.enqueue({
                pos: a,
                dir: null,
                straight: 0,
                path: [],
                turns: [],
                crossesUsed: initialCrosses,
                dist: manhattanDist(a, b)
            })
            visited.add(`${a[0]},${a[1]}`)
    
            while (!pq.isEmpty()) {
                //get the first of the queue
                const curr = pq.dequeue()
                const [cx, cy] = curr.pos
    
                //Commit ( path completed )
                if (cx === b[0] && cy === b[1]) {
                    return {
                        path: curr.path,
                        turns: curr.turns,
                        crossesUsed: curr.crossesUsed
                    }
                }
    
                for (const [dx, dy] of DIRS) {
                    const nx = cx + dx, ny = cy + dy
                    //Out of Bounds
                    if (nx < 0 || ny < 0 || nx >= gridS || ny >= gridS) continue
                    
                    //Already visisited by same path
                    const key = `${nx},${ny}`
                    if (visited.has(key)) continue
    
                    //Too much straights
                    const sameDir = curr.dir && dx === curr.dir[0] && dy === curr.dir[1]
                    const newStraight = sameDir ? curr.straight + 1 : 1
                    if (newStraight > maxStraight) continue
    
                    //Intersection nearby key point
                    if (nearby[nx][ny] && used[nx][ny] >= 1) continue
                    
                    //Intersection on top of turn
                    if (isTurnTile[nx][ny]) continue
                    
                    //Intresections exeeded limit OR Turn on top of another path
                    let newCrosses = curr.crossesUsed
                    if (used[nx][ny] === 1) {
                        if (!sameDir) continue
                        newCrosses++
                    }
                    if (newCrosses > maxCross) continue
    
                    //Store the presence of a turn
                    const newTurns = [...curr.turns]
                    const prev = curr.path[curr.path.length - 1]
                    const isTurn = prev && (dx !== prev[2][0] || dy !== prev[2][1])

                    if (isTurn) newTurns.push([prev[0], prev[1]])
    
                    //Save the dir
                    visited.add(key)
                    pq.enqueue({
                        pos: [nx, ny],
                        dir: [dx, dy],
                        straight: newStraight,
                        path: [...curr.path, [nx, ny, [dx, dy]]],
                        turns: newTurns,
                        crossesUsed: newCrosses,
                        dist: manhattanDist([nx, ny], b)
                    })
                }
            }
            return null
        }
    }
    
    // Helper functions remain the same
    function manhattanDist(a, b) {
        return Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
    }
}

//NOTE - Shuffle Array
function shuffle(array) {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

//NOTE - DrawArrows
function drawArrows(track) {

    const STRAIGHT_ARROWS = {
        "-1,0": "↑",  // up
        "1,0": "↓",   // down
        "0,-1": "←",  // left
        "0,1": "→"    // right
    }
    
    const TURN_ARROWS = {
        "-1,0>0,1": "↳", // up to right
        "0,1>1,0": "⬐",  // right to down
        "1,0>0,-1": "↰", // down to left
        "0,-1>-1,0": "⬏", // left to up
    
        // Reverse turns
        "0,1>-1,0": "⬑",  // right to up
        "1,0>0,1": "↱",   // down to right
        "0,-1>1,0": "⬎",  // left to down
        "-1,0>0,-1": "↲"  // up to left
    }

    track.forEach((cell, i) => {
        let before, after, arrow = "ciao"

        if (i > 0) {
            const [bx, by] = track[(i - 1) % track.length]
            before = [bx - cell[0], by - cell[1]]
        }

        if (i < track.length) {
            const [ax, ay] = track[(i + 1) % track.length]
            after = [ax - cell[0], ay - cell[1]]
        }
        
        if (before && after) {
            // Turn
            arrow = TURN_ARROWS[`${before}>${after}`] || STRAIGHT_ARROWS[`${after}`] || ""
        } else if (after) {
            // Start
            arrow = "●"
        } else if (before) {
            // End
            arrow = STRAIGHT_ARROWS[`${before}`] || ""
        }

        document.getElementById(`${cell[0]}_${cell[1]}`).innerHTML = arrow
        
    })
}