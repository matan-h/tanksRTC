import { joinRoom, selfId } from 'trystero';
import type { Room, ActionSender, DataPayload, ActionReceiver } from 'trystero';
// HTML
const params = new URLSearchParams(location.search);

const roomIdparam = params.get('roomId');
if (roomIdparam) {
    (document.getElementById('roomId') as HTMLInputElement).value = roomIdparam;
}

// TypeScript types
type Wall = {
    x: number;
    y: number;
    width: number;
    height: number;
    originalColor: string;
    currentColor?: string;
    colorChangeTimeout?: number;
};

type Bullet = {
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
    creationTime: number;
    alpha: number;
    owner: string;
};

type TankControls = {
    up: string;
    down: string;
    left: string;
    right: string;
    shoot: string;
};


type ActionType = 'move' | 'shoot' | 'updateBullet' | 'maze' | 'wallColorChange' | 'newGame' | 'gameOver' | 'ping'|'ackMaze';
// TODO: split into types/actions
type Action = {
    type: ActionType;
    x?: number;
    y?: number;
    angle?: number;
    bullet?: Bullet;
    maze?: Wall[];
    wallsUpdated?: { wallIndex: number; color: string }[];
    message?: string;
    originalcreationTime?: number
};
type GameSize = {
    width: number
    height: number
}

interface TankDirection {
    isMovingRight: boolean;
    isMovingLeft: boolean;
    isMovingUp: boolean;
    isMovingDown: boolean;
}


// Constants
const APPID = "multiplayer-tank-game";

const TANK_SIZE = 30;
const BULLET_SIZE = 10;
const WALL_SIZE = 100;

const WALL_VSPACING = 0.2
const BULLET_LIFE = 5;
const FADE_START = 0.10;
const PING_INTERVAL = 1000;
const PING_ALLOWED_MISSES = 5;

// If the angle is greater than n radians, reject teleportation
const MAX_TELEPORT_DEGREES = Math.PI / 4; // 45 degrees in radians
// Maximum teleport wall iterations
const MAX_TELEPORT_DISTANCE = 200;

class Tank {
    x: number;
    y: number;
    angle: number;
    color: string;
    controls: TankControls | null;
    speed: number;
    lastShotTime: number;
    shootCooldown: number;
    maxBullets: number;
    visible: boolean;
    opacity: number;
    teleporting: boolean;
    originalcreationTime: number;
    lastPingSent: number;
    peerId: string;

    constructor(x: number, y: number, color: string, controls: TankControls | null = null, peerId: string, visible = true, originalcreationTime: number | null = null) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.color = color;
        this.controls = controls;
        this.speed = 2;
        this.lastShotTime = 0;
        this.shootCooldown = 200;
        this.maxBullets = 10;
        this.visible = visible;
        this.opacity = 1.0;
        this.teleporting = false;
        this.originalcreationTime = originalcreationTime || Date.now();
        this.lastPingSent = Date.now();
        this.peerId = peerId;
    }

    ownBullets(bullets_list: Bullet[]): Bullet[] {
        return bullets_list.filter(x => x.owner === this.peerId)
    }


    draw(ctx: CanvasRenderingContext2D) {
        if (!this.visible) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2, TANK_SIZE, TANK_SIZE);
        ctx.beginPath();
        ctx.moveTo(TANK_SIZE / 2, TANK_SIZE / 2);
        ctx.lineTo(TANK_SIZE / 2, -TANK_SIZE / 2);
        ctx.lineTo(TANK_SIZE / 2 + 20, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    update_controls(keys: { [key: string]: boolean }, bullets: Bullet[]): Bullet | undefined {
        if (!this.controls) return

        if (keys[this.controls.left]) this.rotate(-1);
        if (keys[this.controls.right]) this.rotate(1);
        if (keys[this.controls.shoot]) return this.shoot(bullets);

    }

    getDirection(keys: { [key: string]: boolean }): TankDirection | undefined {
        if (!this.controls) return

        const cosAngle = Math.cos(this.angle);
        const sinAngle = Math.sin(this.angle);

        // Determine direction based on angle and pressed keys
        const isMovingRight = cosAngle > 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
        const isMovingLeft = cosAngle < 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
        const isMovingDown = sinAngle > 0 && Math.abs(sinAngle) > Math.abs(cosAngle);
        const isMovingUp = sinAngle < 0 && Math.abs(sinAngle) > Math.abs(cosAngle);

        return {
            isMovingRight: keys[this.controls.up] ? isMovingRight : keys[this.controls.down] && isMovingLeft,
            isMovingLeft: keys[this.controls.up] ? isMovingLeft : keys[this.controls.down] && isMovingRight,
            isMovingUp: keys[this.controls.up] ? isMovingUp : keys[this.controls.down] && isMovingDown,
            isMovingDown: keys[this.controls.up] ? isMovingDown : keys[this.controls.down] && isMovingUp,
        };
    }


    private findGroupEnd(startX: number, startY: number, walls: Wall[], size: GameSize, isMovingBackward: boolean): { x: number; y: number, group: Wall[] } | null {
        const group: Wall[] = [];

        const tankMinSize = TANK_SIZE / 16;
        let endX = startX;
        let endY = startY;

        // Determine direction of movement based on angle
        let angle = this.angle
        if (isMovingBackward){
            // angle = angle+180
            angle = angle+Math.PI
        }
        let cosAngle = Math.cos(angle);
        let sinAngle = Math.sin(angle);

        // Define the direction based on the angle (4 possible directions)
        const isMovingRight = cosAngle > 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
        const isMovingLeft = cosAngle < 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
        const isMovingDown = sinAngle > 0 && Math.abs(sinAngle) > Math.abs(cosAngle);
        const isMovingUp = sinAngle < 0 && Math.abs(sinAngle) > Math.abs(cosAngle);

        // Define movement offsets for each direction
        const offsetX = isMovingRight ? 1 : isMovingLeft ? -1 : 0;
        const offsetY = isMovingDown ? 1 : isMovingUp ? -1 : 0;

        // const degrees45 = Math.PI / 4; // 45 degrees in radians

        // Function to calculate the angle between two vectors
        const angleBetweenVectors = (v1x: number, v1y: number, v2x: number, v2y: number): number => {
            const dotProduct = v1x * v2x + v1y * v2y;
            const magnitudeV1 = Math.sqrt(v1x * v1x + v1y * v1y);
            const magnitudeV2 = Math.sqrt(v2x * v2x + v2y * v2y);
            return Math.acos(dotProduct / (magnitudeV1 * magnitudeV2));
        };

        // Keep extending in the direction of movement while walls are consecutive
        for (let i = 0; i < MAX_TELEPORT_DISTANCE; i++) {
            const nextWall = walls.find(wall => {
                const withinX = (endX + offsetX * tankMinSize) >= wall.x && (endX + offsetX * tankMinSize) <= (wall.x + wall.width);
                const withinY = (endY + offsetY * tankMinSize) >= wall.y && (endY + offsetY * tankMinSize) <= (wall.y + wall.height);
                return withinX && withinY;
            });

            if (nextWall) {
            const wallVector = { x: nextWall.x + nextWall.width / 2 - endX, y: nextWall.y + nextWall.height / 2 - endY };
            const movementVector = { x: offsetX, y: offsetY };

            const angleToWall = angleBetweenVectors(movementVector.x, movementVector.y, wallVector.x, wallVector.y);

            if (angleToWall > MAX_TELEPORT_DEGREES) {
                console.log("[45] blocked",(angleToWall*(Math.PI/180)))
                return null;
            }

                
                group.push(nextWall);
                // If a wall is found, extend the position further in that direction

                if (isMovingRight) {
                    endX = nextWall.x + nextWall.width + tankMinSize;
                } else if (isMovingLeft) {
                    endX = nextWall.x - tankMinSize;
                } else if (isMovingDown) {
                    endY = nextWall.y + nextWall.height + tankMinSize;
                } else if (isMovingUp) {
                    endY = nextWall.y - tankMinSize;
                }

            } else {
                // Stop if no more consecutive walls are found
                break;
            }
        }

        // Ensure the final position is within the canvas bounds
        if (endX < tankMinSize || endX > (size.width - tankMinSize) ||
            endY < tankMinSize || endY > (size.height - tankMinSize)) {
            return null;
        }

        return { x: endX, y: endY, group: group };
    } 
    
        
        
    

    move(walls: Wall[], size: GameSize, keys: { [key: string]: boolean }) {
        if (!this.controls) return
        const isMovingBackward = keys[this.controls.down];

        const tankHalfSize = TANK_SIZE / 2;
        
        const nextXadd = this.speed * Math.cos(this.angle);
        const nextYadd = this.speed * Math.sin(this.angle);
        let newX = this.x;
        let newY = this.y;
        
        let wallsUpdated: { wallIndex: number; color: string }[] = [];
        
        if (keys[this.controls.up]) {
            newX += nextXadd;
            newY += nextYadd;
        } else if (isMovingBackward) {
            newX -= nextXadd;
            newY -= nextYadd;
        }
        if (!this.collides(newX, newY, walls)) {
            // Move the tank normally if no collision
            this.x = Math.max(tankHalfSize, Math.min(newX, size.width - tankHalfSize));
            this.y = Math.max(tankHalfSize, Math.min(newY, size.height - tankHalfSize));
        } else {
            const alreadyCollides = this.collides(this.x,this.y,walls);

            const wallEnd = this.findGroupEnd(newX, newY, walls, size, isMovingBackward);
            wallEnd?.group.forEach(wall => {



                if (wall.colorChangeTimeout) {
                    clearTimeout(wall.colorChangeTimeout);
                }
                wall.currentColor = this.color;

                wall.colorChangeTimeout = setTimeout(() => {
                    wall.currentColor = wall.originalColor;
                }, 300);
                wallsUpdated.push({ wallIndex: walls.indexOf(wall), color: this.color });
            });
            if (wallEnd) {
                if (alreadyCollides){this.x =wallEnd.x;this.y = wallEnd.y }
                else this.teleport(wallEnd.x, wallEnd.y, walls, size);
            } 

        }
        return wallsUpdated

    }




    private teleport(newX: number, newY: number, walls: Wall[], size: GameSize): boolean {
        // Define boundaries based on canvas size and tank size
        const tankHalfSize = TANK_SIZE / 2;

        // Check if the new position is within screen bounds
        const isOutsideBounds = newX < tankHalfSize || newX > (size.width - tankHalfSize) ||
            newY < tankHalfSize || newY > (size.height - tankHalfSize);

        if (isOutsideBounds) {
            console.log('Teleport blocked: out of bounds');
            return false; // Prevent teleportation if out of bounds
        }

        // Check for collisions with walls at the new position
        if (!this.collides(newX, newY, walls)) {
            // If no collision, allow teleportation
            this.x = newX;
            this.y = newY;
            return true;
        } else {
            console.log('Teleport blocked by wall');
            return false;
        }
    }

    rotate(dir: number) {
        this.angle += dir * 0.1;
    }

    shoot(bullets: Bullet[]) {
        const now = Date.now();
        if (now - this.lastShotTime > this.shootCooldown) {
            if (this.ownBullets(bullets).length < this.maxBullets) {
                const bullet: Bullet = {
                    id: uuidv4(),
                    x: this.x + Math.cos(this.angle) * TANK_SIZE + 2,
                    y: this.y + Math.sin(this.angle) * TANK_SIZE + 2,
                    dx: Math.cos(this.angle) * 5,
                    dy: Math.sin(this.angle) * 5,
                    creationTime: now,
                    alpha: 1.0,
                    owner: this.peerId
                };
                bullets.push(bullet);

                this.lastShotTime = now;
                return bullet
            }
        }
    }


    checkCollisionWithBullet(bullet: Bullet): boolean {
        // Calculate the tank's four corners based on its angle
        const halfSize = TANK_SIZE / 2;
        const corners = [
            { x: this.x - halfSize, y: this.y - halfSize },
            { x: this.x + halfSize, y: this.y - halfSize },
            { x: this.x + halfSize, y: this.y + halfSize },
            { x: this.x - halfSize, y: this.y + halfSize }
        ];

        // Rotate the corners around the center of the tank
        const rotatedCorners = corners.map(corner => this.rotatePoint(corner, { x: this.x, y: this.y }, this.angle));

        // Check if the bullet is within the rotated rectangle using SAT (Separating Axis Theorem)
        return this.pointInRotatedRectangle(bullet.x, bullet.y, rotatedCorners);
    }

    // Rotate a point around a given center by a certain angle
    rotatePoint(point: { x: number, y: number }, center: { x: number, y: number }, angle: number): { x: number, y: number } {
        const cosTheta = Math.cos(angle);
        const sinTheta = Math.sin(angle);

        const dx = point.x - center.x;
        const dy = point.y - center.y;

        return {
            x: cosTheta * dx - sinTheta * dy + center.x,
            y: sinTheta * dx + cosTheta * dy + center.y
        };
    }

    // Check if a point (e.g., bullet) is inside a rotated rectangle using SAT
    pointInRotatedRectangle(px: number, py: number, corners: { x: number, y: number }[]): boolean {
        // Function to calculate the dot product of two vectors
        const dotProduct = (v1: { x: number, y: number }, v2: { x: number, y: number }) => v1.x * v2.x + v1.y * v2.y;

        // Function to subtract two points to create a vector
        const subtract = (p1: { x: number, y: number }, p2: { x: number, y: number }) => ({ x: p1.x - p2.x, y: p1.y - p2.y });

        // Create axes (normals) for the rectangle edges
        const axes = [
            subtract(corners[1], corners[0]), // Edge between corner 0 and corner 1
            subtract(corners[3], corners[0])  // Edge between corner 0 and corner 3
        ];

        // For each axis, project the point and rectangle corners, and check for overlap
        for (let axis of axes) {
            const projections = corners.map(corner => dotProduct(corner, axis));
            const minRectProj = Math.min(...projections);
            const maxRectProj = Math.max(...projections);

            const bulletProj = dotProduct({ x: px, y: py }, axis);

            if (bulletProj < minRectProj || bulletProj > maxRectProj) {
                // No overlap on this axis, so no collision
                return false;
            }
        }

        // Overlaps on both axes, so there is a collision
        return true;
    }

    collides(x: number, y: number, walls: Wall[]): boolean {
        return walls.some(wall => {
            return (x > wall.x && x < wall.x + wall.width &&
                y > wall.y && y < wall.y + wall.height);
        });
    }
}
function uuidv4() { // overkill- so:105034
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
}

class Game {
    // private canvas: HTMLCanvasElement;
    private gameSize: GameSize;
    private ctx: CanvasRenderingContext2D;
    private localTank: Tank;
    private remoteTanks: Tank[];
    private bullets: Bullet[];
    private walls: Wall[];
    // private groupedWalls: Wall[];
    private keys: { [key: string]: boolean };
    private gameOver: boolean;
    private winMessage: string;
    private room: Room; // Replace with appropriate type from Trystero library
    private restartTimeout: number | null;
    private Actions: { send: ActionSender<DataPayload>; receive: ActionReceiver<DataPayload>; };

    private static PING_INTERVAL = PING_INTERVAL;
    private static PING_ALLOWED_MISSES = PING_ALLOWED_MISSES;

    constructor(canvasId: string, roomId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        canvas.style.visibility = "visible";

        this.ctx = canvas.getContext('2d')!;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // FIXME : find better way to do screen sizing.

        this.gameSize = { height: canvas.height, width: canvas.width }

        this.localTank = new Tank(
            this.gameSize.width / 2,
            this.gameSize.height / 2,
            'blue',
            {
                up: 'ArrowUp',
                down: 'ArrowDown',
                left: 'ArrowLeft',
                right: 'ArrowRight',
                shoot: ' '
            },
            selfId
        );
        this.remoteTanks = [];
        this.bullets = [];
        this.walls = [];
        this.keys = {};
        this.gameOver = false;
        this.winMessage = '';
        this.restartTimeout = null;
        this.room = joinRoom({ appId: APPID }, roomId);
        let [sendAction, getAction] = this.room.makeAction('action');
        this.Actions = { send: sendAction, receive: getAction }



        this.setupEventListeners();
        this.startNewGame();
    }

    private setupEventListeners() {
        window.addEventListener('keydown', (event) => {
            this.keys[event.key] = true;
        });

        window.addEventListener('keyup', (event) => {
            this.keys[event.key] = false;
        });

        this.room.onPeerLeave(peerId => {
            console.log(`${peerId} left`);
            // Remove the tank of the peer that left
            this.removeTank(peerId);

        });

        this.room.onPeerJoin((peerId: string) => {
            console.log(`${peerId} joined`);
            if (peerId.localeCompare(selfId) === 1) {
                this.sendAction({ type: 'maze', maze: this.walls });
                this.sendAction({
                    type: 'move',
                    x: this.localTank.x,
                    y: this.localTank.y,
                    angle: this.localTank.angle,
                    originalcreationTime: this.localTank.originalcreationTime
                });

                this.remoteTanks.forEach(tank => {
                    this.sendAction({
                        type: 'move',
                        x: tank.x,
                        y: tank.y,
                        angle: tank.angle,
                        originalcreationTime: this.localTank.originalcreationTime
                    }, peerId);
                });
            }
        });

        this.room.onPeerLeave(peerId => {
            console.log(`${peerId} left`);
            this.removeTank(peerId);
        });

        this.Actions.receive((data, peerId: string) => {
            if (data && (data as Action).type) {
                this.handleAction(data as Action, peerId);
            }
        });

        setInterval(this.sendPing.bind(this), Game.PING_INTERVAL);
    }


    private sendAction(action: Action, peerId?: string) {
        this.Actions.send(action, peerId)
    }

    private removeTank(peerId: string) {
        this.remoteTanks = this.remoteTanks.filter(tank => tank.peerId !== peerId);
    }

    private handleAction(data: Action, peerId: string) {
        switch (data.type) {
            case 'move':
                if (data.x === undefined || data.y === undefined || data.angle === undefined) { return }

                let tank = this.remoteTanks.find(t => t.peerId === peerId);
                if (!tank) {
                    const color = this.getRandomColor();
                    tank = new Tank(
                        data.x,
                        data.y,
                        color, null,
                        peerId, true,
                        data.originalcreationTime
                    );
                    this.remoteTanks.push(tank);
                }
                tank.x = data.x;
                tank.y = data.y;
                tank.angle = data.angle;
                break;

            case 'shoot':
                const bullet = data.bullet!;
                this.bullets.push(bullet);
                break;

            case 'updateBullet':
                const updatedBullet = data.bullet!;
                const existingBullet = this.bullets.find(b => b.id === updatedBullet.id);
                if (existingBullet) {
                    Object.assign(existingBullet, updatedBullet);
                }
                break;

            case 'maze':
                this.setWalls(data.maze!);
                this.drawWalls();
                break;
            case 'ackMaze':
                this.sendAction({ type: 'maze', maze: this.walls },peerId);
                break

            case 'wallColorChange':
                const wallsUpdated = data.wallsUpdated!;
                wallsUpdated.forEach(wallData => {
                    const wall = this.walls[wallData.wallIndex];
                    if (wall) {
                        wall.currentColor = this.remoteTanks.find(t => t.peerId === peerId)?.color;
                        setTimeout(() => {
                            wall.currentColor = wall.originalColor;
                        }, 300);
                    }
                });
                break;

            case 'newGame':
                const localTankPosition = this.getRandomPositionOutsideMaze();
                this.localTank.x = localTankPosition.x;
                this.localTank.y = localTankPosition.y;
                this.localmove()
                break;

            case 'gameOver':
                this.gameOver = true;
                this.winMessage = data.message!;
                break;

            case 'ping':
                const tankPing = this.remoteTanks.find(t => t.peerId === peerId);
                if (tankPing) {
                    tankPing.lastPingSent = Date.now();
                }
                break;

            default:
                console.warn('Unknown action type:', data.type);
        }
    }

    private generateMaze(): Wall[] {
        const maze: Wall[] = [];
        const mazeWidth = this.gameSize.width / (WALL_SIZE);
        const mazeHeight = this.gameSize.height / (WALL_SIZE);

        for (let i = 0; i < mazeWidth; i++) {
            for (let j = 0; j < mazeHeight; j++) {
                if (Math.random() < 0.3) {
                    maze.push({
                        x: i * (WALL_SIZE),
                        y: j * (WALL_SIZE),
                        width: WALL_SIZE,
                        height: WALL_SIZE,
                        originalColor: 'gray'
                    });
                }
            }
        }

        return maze;
    }


    private drawWalls() {
        this.ctx.fillStyle = 'gray'; // Default color
        // Visual spacing of 0.2 between walls
        this.walls.forEach(wall => {
            this.ctx.fillStyle = wall.currentColor || wall.originalColor;
            this.ctx.fillRect(wall.x, wall.y, wall.width - WALL_VSPACING, wall.height - WALL_VSPACING);
        });
    }

    private drawBullets() {
        this.bullets.forEach(bullet => {
            const age = (Date.now() - bullet.creationTime) / 1000;
            if (age > 30) return;
            this.ctx.save();
            this.ctx.globalAlpha = bullet.alpha || 0;
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(bullet.x - BULLET_SIZE / 2, bullet.y - BULLET_SIZE / 2, BULLET_SIZE, BULLET_SIZE);
            this.ctx.restore();
        });
    }

    private checkCollisions() {

        this.bullets.forEach(bullet => {

            if (this.localTank.checkCollisionWithBullet(bullet)) {
                this.gameOver = true;
                this.winMessage = 'Game over!';
                this.sendAction({ type: 'gameOver', message: 'You win' });
            } else {
                this.remoteTanks.forEach(tank => {
                    if (tank.checkCollisionWithBullet(bullet)) {
                        this.gameOver = true;
                        this.winMessage = 'You Win!';
                        this.sendAction({ type: 'gameOver', message: 'Game Over' });
                    }
                });
            }
        });
    }

    private checkInactiveTanks() {
        const now = Date.now();
        this.remoteTanks.forEach(tank => {
            if (now - tank.lastPingSent > Game.PING_ALLOWED_MISSES * Game.PING_INTERVAL) {
                console.log(`Tank ${tank.peerId} is not sending pings. Removing...`);
                this.removeTank(tank.peerId);
            }
        });
    }

    private drawWinLoseBanner() {
        if (this.gameOver) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent background
            this.ctx.fillRect(0, 0, this.gameSize.width, this.gameSize.height); // Fill the entire canvas with background color

            this.ctx.font = '48px Arial';
            this.ctx.fillStyle = 'white'; // Text color
            const text = this.winMessage;
            const textWidth = this.ctx.measureText(text).width;
            this.ctx.fillText(text, this.gameSize.width / 2 - textWidth / 2, this.gameSize.height / 2);

            this.ctx.restore();
        }
    }



    private startNewGame() {
        // Reset game state
        this.gameOver = false;
        this.winMessage = '';
        this.setWalls([]);
        this.bullets = [];
        this.localTank.x = this.gameSize.width / 2;
        this.localTank.y = this.gameSize.height / 2;

        const waitingForPid = [...this.remoteTanks, this.localTank].sort((a, b) => a.originalcreationTime - b.originalcreationTime)[0].peerId;
        if (waitingForPid === selfId) {
            const newMaze = this.generateMaze();
            this.setWalls(newMaze);
            console.log('Attempt to start a new game\nRemote:', [...this.remoteTanks.map(tank => tank.originalcreationTime), this.localTank.originalcreationTime].sort(), selfId);
            this.sendAction({ type: 'maze', maze: newMaze });
            this.sendAction({ type: 'newGame' });
        } else {
            console.log('Waiting for PID', waitingForPid);
            // TODO: handle the case it errors.
        }

        const localTankPosition = this.getRandomPositionOutsideMaze();
        this.localTank.x = localTankPosition.x;
        this.localTank.y = localTankPosition.y;


        // Restart game loop
        this.gameLoop();
    }

    private getRandomColor(): string {
        const colors = ['red', 'green', 'yellow', 'purple', 'orange', 'pink'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private getRandomPositionOutsideMaze(): { x: number, y: number } {
        // Implement logic to find a random position outside of the maze
        return { x: Math.random() * this.gameSize.width, y: Math.random() * this.gameSize.height };
    }
    sendPing() {
        this.sendAction({ type: 'ping' });
        this.localTank.lastPingSent = Date.now();
    }

    private updateBullets() {
        this.bullets.filter(bullet => {
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;
            // bullet.alpha -= 0.01;
            // Reflect bullets on screen edges
            if (bullet.x <= 0 || bullet.x >= this.gameSize.width) bullet.dx *= -1;
            if (bullet.y <= 0 || bullet.y >= this.gameSize.height) bullet.dy *= -1;
            // Bullet's bounding box
            const bulletLeft = bullet.x - BULLET_SIZE / 2;
            const bulletRight = bullet.x + BULLET_SIZE / 2;
            const bulletTop = bullet.y - BULLET_SIZE / 2;
            const bulletBottom = bullet.y + BULLET_SIZE / 2;

            this.walls.forEach(wall => {

                // Wall's bounding box
                const wallLeft = wall.x;
                const wallRight = wall.x + wall.width;
                const wallTop = wall.y;
                const wallBottom = wall.y + wall.height;

                // Check for collision between bullet and wall
                if (bulletRight > wallLeft && bulletLeft < wallRight && bulletBottom > wallTop && bulletTop < wallBottom) {
                    // Calculate normal vector of the wall
                    let normalX, normalY;

                    // Determine which side of the wall the bullet hit
                    const leftDistance = Math.abs(bulletRight - wallLeft);
                    const rightDistance = Math.abs(bulletLeft - wallRight);
                    const topDistance = Math.abs(bulletBottom - wallTop);
                    const bottomDistance = Math.abs(bulletTop - wallBottom);

                    if (leftDistance < rightDistance && leftDistance < topDistance && leftDistance < bottomDistance) {
                        normalX = -1;
                        normalY = 0;
                    } else if (rightDistance < topDistance && rightDistance < bottomDistance) {
                        normalX = 1;
                        normalY = 0;
                    } else if (topDistance < bottomDistance) {
                        normalX = 0;
                        normalY = -1;
                    } else {
                        normalX = 0;
                        normalY = 1;
                    }

                    // Reflect the bullet off the wall
                    const dotProduct = bullet.dx * normalX + bullet.dy * normalY;
                    bullet.dx -= 2 * dotProduct * normalX;
                    bullet.dy -= 2 * dotProduct * normalY;
                }
            });


            // Update bullet's age and alpha for fading effect
            const age = (Date.now() - bullet.creationTime) / 1000;
            if (age > BULLET_LIFE) {
                bullet.alpha = 0; // Completely disappear after bulletLife
            } else if (age > FADE_START && bullet.alpha < 0.6) {
                // Linear fade out effect
                bullet.alpha = Math.max(0, (BULLET_LIFE - age) / (BULLET_LIFE - FADE_START));
            } else {
                bullet.alpha = 1; // Fully visible
            }
            return bullet.alpha > 0; // Keep bullets that are still visible
        });


        this.bullets = this.bullets.filter(bullet => bullet.alpha > 0.5);

    }
    private setWalls(walls: Wall[]) {
        this.walls = walls;
        // this.groupedWalls = groupWallsForTeleport(walls);
    }
    private localmove() {
        let wallsUpdated = this.localTank.move(this.walls, this.gameSize, this.keys);
        if (wallsUpdated && wallsUpdated.length > 0) {
            this.sendAction({ type: "wallColorChange", wallsUpdated })
        }
    }

    private gameLoop() {
        if (this.gameOver) {
            this.drawWinLoseBanner();
            if (this.restartTimeout === null) {
                this.restartTimeout = setTimeout(() => {
                    this.startNewGame();
                    this.restartTimeout = null;
                }, 3000); // Wait for 3 seconds before restarting
            }
            return;
        }

        this.ctx.clearRect(0, 0, this.gameSize.width, this.gameSize.height);

        // Update local tank and bullets
        if (!this.gameOver) {
            // if (this.walls.length===0) this.sendAction({ type: 'ackMaze' });   
            let shoot_bullet = this.localTank.update_controls(this.keys, this.bullets);
            if (shoot_bullet) this.sendAction({ type: 'shoot', bullet: shoot_bullet });
            this.localmove()
        }
        else{
            this.walls = [];
        }
        this.updateBullets();

        // Broadcast local actions
        this.sendAction({
            type: 'move',
            x: this.localTank.x,
            y: this.localTank.y,
            angle: this.localTank.angle,
            originalcreationTime: this.localTank.originalcreationTime
        });

        // Broadcast bullet positions
        this.localTank.ownBullets(this.bullets).forEach(bullet => {
            this.sendAction({
                type: 'updateBullet',
                bullet: bullet
            });
        });

        // Draw everything
        this.drawWalls();
        this.localTank.draw(this.ctx);
        this.remoteTanks.forEach(tank => tank.draw(this.ctx));

        this.drawBullets();

        // Local Tank controls

        this.checkCollisions();
        this.checkInactiveTanks();

        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialization
const HTMLform = document.getElementById('roomIdForm') as HTMLFormElement;

HTMLform.addEventListener('submit', (event) => {
    event.preventDefault();
    HTMLform.style.display = 'none';

    const roomId = (document.getElementById('roomId') as HTMLInputElement).value.trim();
    new Game('gameCanvas', (roomId || "public"));
});
