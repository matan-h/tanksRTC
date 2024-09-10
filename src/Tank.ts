// Tank.ts

import { Constants } from './Constants';
import { Bullet } from './Bullet';

import { findGroupEnd, isPointInTriangle, pointInRotatedRectangle, rotatePoint } from './Utils'; // Helper function for collision detection
import { GameSize, TankControls, Wall } from './Types';

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
    opacity: number;

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
        this.opacity = 1.0

        this.peerId = peerId;
        this.isRemote = isRemote;
        this.originalCreationTime = originalCreationTime;
        this.lastPingSent = Date.now();
    }

    updateControls(keys: { [key: string]: boolean }, bullets: Bullet[], walls: Wall[], size: GameSize) {
        if (!this.controls) return { shootBullet: null, wallsUpdated: null };

        let shootBullet: Bullet | null = null;
        const wallsUpdated: { wallIndex: number }[] = [];

        if (keys[this.controls.shoot]) {
            shootBullet = this.shoot(bullets) || null;
        }
        // Movement logic
        const {newX, newY} = this.move(keys);
        let angle =this.angle;
        if (keys[this.controls!.left]) {
            angle -= 0.1; // Rotate left
        }
        if (keys[this.controls!.right]) {
            angle += 0.1; // Rotate right
        }

        if (!this.WallCollides(newX, newY, walls) || this.WallCollides(this.x, this.y, walls)) {
            console.log('move normally')
            // Move the tank normally if no collision
            if (!this.isOutOfBounds(newX,newY,angle,size)){
                console.log("!OOB")

            this.angle = angle
            this.x = newX
            this.y = newY
        }
        else if (!this.isOutOfBounds(this.x,this.y,angle,size)){
                this.angle = angle

            }
        }
        else {
            console.log('teleport')
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
        const alreadyCollides = this.WallCollides(this.x, this.y, walls);
        if (!alreadyCollides) return;
        const wallEnd = findGroupEnd(this.angle, this.x, this.y, walls, size, true);
        if (wallEnd) {
            this.x = wallEnd.x
            this.y = wallEnd.y
        }
    }

    shoot(bullets: Bullet[]): Bullet | undefined {
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

        return {newX, newY}
    }
    private isOutOfBounds(newX:number,newY:number,angle:number,size:GameSize) {
        const tankHalfSize = Constants.TANK_SIZE / 2;

        // Calculate the bounds of the rectangular body
        const rectLeft = newX - tankHalfSize;
        const rectRight = newX + tankHalfSize;
        const rectTop = newY - tankHalfSize;
        const rectBottom = newY + tankHalfSize;

        // Check if the rectangle is within the world boundaries
        const outOfBoundsRectangle = rectLeft < 0 || rectRight > size.width || rectTop < 0 || rectBottom > size.height;

        // Calculate the turret's triangular vertices
        const turretVertices = [
            { x: newX + tankHalfSize, y: newY + tankHalfSize },
            { x: newX + tankHalfSize, y: newY - tankHalfSize },
            { x: newX + tankHalfSize + 20, y: newY }
        ].map(vertex => rotatePoint(vertex, { x: newX, y: newY }, angle));

        // Check if any turret vertex is out of bounds
        const outOfBoundsTurret = turretVertices.some(vertex =>
            vertex.x < 0 || vertex.x > size.width || vertex.y < 0 || vertex.y > size.height
        );

        return outOfBoundsRectangle || outOfBoundsTurret;

    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
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
        const halfSize = Constants.TANK_SIZE / 2;
        const rect_corners = [
            { x: this.x - halfSize, y: this.y - halfSize },
            { x: this.x + halfSize, y: this.y - halfSize },
            { x: this.x + halfSize, y: this.y + halfSize },
            { x: this.x - halfSize, y: this.y + halfSize }
        ];
        const rotatedCorners = rect_corners.map(corner => rotatePoint(corner, { x: this.x, y: this.y }, this.angle));

        const turretVertices = [
            { x: this.x + halfSize, y: this.y + halfSize },
            { x: this.x + halfSize, y: this.y - halfSize },
            { x: this.x + halfSize + Constants.TURRET_SIZE, y: this.y }
        ].map(vertex => rotatePoint(vertex, { x: this.x, y: this.y }, this.angle));

        // Check if the bullet is within the rotated rectangle using SAT (Separating Axis Theorem)
        return pointInRotatedRectangle(bullet.x, bullet.y, rotatedCorners) || isPointInTriangle(bullet.x, bullet.y, turretVertices[0], turretVertices[1], turretVertices[2]);;
    }
    ownBullets(bullets_list: Bullet[]): Bullet[] {
        return bullets_list.filter(x => x.owner === this.peerId)
    }

    WallCollides(x: number, y: number, walls: Wall[]): boolean {

        return walls.some(wall => {
            const SAFE_MARGIN = 0
            const extendedLeft = wall.x - SAFE_MARGIN;
            const extendedRight = wall.x + wall.width + SAFE_MARGIN;
            const extendedTop = wall.y - SAFE_MARGIN;
            const extendedBottom = wall.y + wall.height + SAFE_MARGIN;
            return (x > extendedLeft && x < extendedRight &&
                y > extendedTop && y < extendedBottom);
        });

    }

}
