// Tank.ts

import { Constants } from './Constants';
import { Bullet } from './Bullet';

import { findGroupEnd, isPointInTriangle, pointInRotatedRectangle, rotatePoint } from './Utils'; // Helper function for collision detection
import { GameSize, TankControls, TankShape, Wall } from './Types';

export class Tank {
    x: number;
    y: number;
    angle: number;
    color: string;
    controls: TankControls | null;

    lastShotTime: number;
    peerId: string;
    originalCreationTime: number;
    lastPingSent: number;
    isRemote: boolean;
    isEliminated: boolean;

    speed: number = Constants.TANK_SPEED

    constructor(
        x: number,
        y: number,
        color: string,
        controls: TankControls | null,
        peerId: string,
        isRemote: boolean = false,
        originalCreationTime: number = Date.now()
    ) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.color = color;
        this.controls = controls;
        this.lastShotTime = 0;
        this.isEliminated = false;

        this.peerId = peerId;
        this.isRemote = isRemote;
        this.originalCreationTime = originalCreationTime;
        this.lastPingSent = Date.now();
    }

    updateControls(keys: { [key: string]: boolean }, bullets: Bullet[], walls: Wall[], size: GameSize) {

        if (!this.controls||this.isEliminated) return { shootBullet: null, wallsUpdated: null };

        let shootBullet: Bullet | null = null;
        const wallsUpdated: { wallIndex: number }[] = [];

        if (keys[this.controls.shoot]) {
            shootBullet = this.shoot(bullets) || null;
        }
        // Movement logic
        const { newX, newY } = this.move(keys);
        let angle = this.angle;
        if (keys[this.controls!.left]) {
            angle -= 0.1; // Rotate left
        }
        if (keys[this.controls!.right]) {
            angle += 0.1; // Rotate right
        }
        const OOB = this.howOutOfBounds(newX, newY, angle, size)

        if (!this.WallCollides(newX, newY,walls) || this.WallCollides(this.x, this.y,walls)) {
            // Move the tank normally if no collision
            if (!OOB.isOut) {

                this.angle = angle
                this.x = newX
                this.y = newY
            }
            else{
                this.x = OOB.outPos.x
                this.y = OOB.outPos.y
                this.angle = angle

            }

        }
        else {
            this.angle = angle
            const wallEnd = findGroupEnd(this.angle, newX, newY, walls, size, keys[this.controls!.down]);
            if (wallEnd) {
                wallEnd.group.forEach(wall => {
                    wall.currentColor = this.color;

                    setTimeout(() => {
                        wall.currentColor = wall.originalColor;
                    }, 300);
                    wallsUpdated.push({ wallIndex: walls.indexOf(wall) });
                });
                this.x = wallEnd.x
                this.y = wallEnd.y
            }
        }


        return { shootBullet, wallsUpdated };
    }
    moveOut(walls: Wall[], size: GameSize) {
        const alreadyCollides = this.WallCollides(this.x, this.y,walls);
        if (!alreadyCollides) return;
        const OOB = this.howOutOfBounds(this.x, this.y, this.angle, size);

        if (OOB.isOut) {
            this.x = OOB.outPos.x
            this.y = OOB.outPos.y

        }
        const wallEnd = findGroupEnd(this.angle, this.x, this.y, walls, size, true);
        if (wallEnd) {
            this.x = wallEnd.x
            this.y = wallEnd.y
        }
    }

    shoot(bullets: Bullet[]): Bullet | undefined {
        if (this.isEliminated) return; // Eliminated tanks can't shoot

        const now = Date.now();
        if (now - this.lastShotTime > Constants.SHOOT_COOLDOWN) {
            if (this.ownBullets(bullets).length < Constants.TANK_BULLETS_MAX) {
                const bullet = new Bullet(
                    bullets.length,
                    this.x + Math.cos(this.angle) * (Constants.TANK_SIZE / 2 + Constants.TURRET_SIZE),
                    this.y + Math.sin(this.angle) * (Constants.TANK_SIZE / 2 + Constants.TURRET_SIZE),
                    Math.cos(this.angle) * 5,
                    Math.sin(this.angle) * 5,
                    this.peerId
                )
                this.lastShotTime = now;
                bullets.push(bullet);
                return bullet
            };

        }
    }


    private move(keys: { [key: string]: boolean }) {

        const speed = this.speed;
        let newX = this.x
        let newY = this.y

        if (keys[this.controls!.up]) {
            newX += Math.cos(this.angle) * speed;
            newY += Math.sin(this.angle) * speed;
        }
        if (keys[this.controls!.down]) {
            newX -= Math.cos(this.angle) * speed;
            newY -= Math.sin(this.angle) * speed;
        }

        return { newX, newY }
    }
    private howOutOfBounds(newX: number, newY: number, angle: number, size: GameSize): { outPos: { x: number, y: number }, isOut: boolean } {
        const tankHalfSize = Constants.TANK_SIZE / 2;
    const turretOffset = 20; // Turret length or offset from the tank center

    // Calculate the bounds of the rectangular body
    const rectLeft = newX - tankHalfSize;
    const rectRight = newX + tankHalfSize;
    const rectTop = newY - tankHalfSize;
    const rectBottom = newY + tankHalfSize;

    // Calculate the turret's triangular vertices
    const turretVertices = [
        { x: newX + tankHalfSize, y: newY + tankHalfSize },
        { x: newX + tankHalfSize, y: newY - tankHalfSize },
        { x: newX + tankHalfSize + turretOffset, y: newY }
    ].map(vertex => rotatePoint(vertex, { x: newX, y: newY }, angle));

    // Initialize the adjustments to zero
    let adjustX = 0;
    let adjustY = 0;

    // Calculate the required adjustments for the rectangular body
    if (rectLeft < 0) {
        adjustX = Math.max(adjustX, -rectLeft);
    } else if (rectRight > size.width) {
        adjustX = Math.min(adjustX, size.width - rectRight);
    }

    if (rectTop < 0) {
        adjustY = Math.max(adjustY, -rectTop);
    } else if (rectBottom > size.height) {
        adjustY = Math.min(adjustY, size.height - rectBottom);
    }

    // Calculate the required adjustments for the turret vertices
    turretVertices.forEach(vertex => {
        if (vertex.x < 0) {
            adjustX = Math.max(adjustX, -vertex.x);
        } else if (vertex.x > size.width) {
            adjustX = Math.min(adjustX, size.width - vertex.x);
        }

        if (vertex.y < 0) {
            adjustY = Math.max(adjustY, -vertex.y);
        } else if (vertex.y > size.height) {
            adjustY = Math.min(adjustY, size.height - vertex.y);
        }
    });

    // Calculate the final position
    const retX = newX + adjustX;
    const retY = newY + adjustY;

    // Determine if the tank is out of bounds
    const isOut = adjustX !== 0 || adjustY !== 0;

    return { outPos: { x: retX, y: retY }, isOut };

    }

    public GetShape(x:number,y:number,angle:number): TankShape {

        const halfSize = Constants.TANK_SIZE / 2;
        const rect_corners = [
            { x: x - halfSize, y: y - halfSize },
            { x: x + halfSize, y: y - halfSize },
            { x: x + halfSize, y: y + halfSize },
            { x: x - halfSize, y: y + halfSize }
        ].map(corner => rotatePoint(corner, { x: x, y: y }, angle));


        // Calculate the turret's triangular vertices
        const turretVertices = [
            { x: x + halfSize, y: y + halfSize },
            { x: x + halfSize, y: y - halfSize },
            { x: x + halfSize + Constants.TURRET_SIZE, y: y }
        ].map(vertex => rotatePoint(vertex, { x: x, y: y }, angle));


        return {
            rect: rect_corners,
            turret: turretVertices
        };
    }



    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.isEliminated ? 'lightgrey' : this.color;
        ctx.fillRect(-Constants.TANK_SIZE / 2, -Constants.TANK_SIZE / 2, Constants.TANK_SIZE, Constants.TANK_SIZE);
        ctx.beginPath();
        ctx.moveTo(Constants.TANK_SIZE / 2, Constants.TANK_SIZE / 2);
        ctx.lineTo(Constants.TANK_SIZE / 2, -Constants.TANK_SIZE / 2);
        ctx.lineTo(Constants.TANK_SIZE / 2 + Constants.TURRET_SIZE, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    checkCollisionWithBullet(bullet: Bullet): boolean {
        // Calculate the tank's four corners based on its angle
        const shape = this.GetShape(this.x,this.y,this.angle);

        const rect_corners =shape.rect;

        const turretVertices = shape.turret;

        // Check if the bullet is within the rotated rectangle using SAT (Separating Axis Theorem)
        return pointInRotatedRectangle(bullet.x, bullet.y, rect_corners) || isPointInTriangle(bullet.x, bullet.y, turretVertices[0], turretVertices[1], turretVertices[2]);;
    }
    ownBullets(bullets_list: Bullet[]): Bullet[] {
        return bullets_list.filter(x => x.owner === this.peerId)
    }

    WallCollides(x: number, y: number, walls: Wall[]): boolean {
        // TODO: use shape.
        

        return walls.some(wall => {
            const extendedLeft = wall.x;
            const extendedRight = wall.x + wall.width;
            const extendedTop = wall.y;
            const extendedBottom = wall.y + wall.height;
            return (x > extendedLeft && x < extendedRight &&
                y > extendedTop && y < extendedBottom)
        });

    }

}
