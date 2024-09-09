// Tank.ts

import { Constants } from './Constants';
import { Bullet } from './Bullet';

import { findGroupEnd, isPointInRect, pointInRotatedRectangle, rotatePoint, uuidv4 } from './Utils'; // Helper function for collision detection
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
    
    speed:number = Constants.TANK_SPEED
    
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
    
    updateControls(keys: { [key: string]: boolean }, bullets: Bullet[], walls: Wall[], size: GameSize): Bullet | null {
        if (!this.controls) return null;

        let shootBullet: Bullet | null = null;
        const wallsUpdated = [];

        if (keys[this.controls.shoot]) {
            shootBullet = this.shoot(bullets) || null;
        }
        // Movement logic
        const [newX, newY] = this.move(keys);
        if (!this.WallCollides(newX, newY, walls)) {
            const tankHalfSize = Constants.TANK_SIZE / 2;
            // Move the tank normally if no collision
            this.x = Math.max(tankHalfSize, Math.min(newX, size.width - tankHalfSize));
            this.y = Math.max(tankHalfSize, Math.min(newY, size.height - tankHalfSize));
        }
        else {
            const alreadyCollides = this.WallCollides(this.x, this.y, walls);
            const wallEnd = findGroupEnd(this.angle, newX, newY, walls, size, keys[this.controls!.down]);
            if (wallEnd) {
                wallEnd.group.forEach(wall => {
                    wall.currentColor = this.color;
                    
                    setTimeout(() => {
                        wall.currentColor = wall.originalColor;
                    }, 300);
                    wallsUpdated.push({ wallIndex: walls.indexOf(wall), color: this.color });
                });
                if (alreadyCollides) { this.x = wallEnd.x; this.y = wallEnd.y }
                else {
                    this.x = wallEnd.x
                    this.y = wallEnd.y
                }
            }
            
        }
        
        
        
        return shootBullet;
    }
    moveOut(walls:Wall[]) {
        const alreadyCollides = this.WallCollides(this.x, this.y, walls);
        if (!alreadyCollides) return;
        // TODO
            


        
    }
    
    shoot(bullets: Bullet[]): Bullet | undefined {
        const now = Date.now();
        if (now - this.lastShotTime > Constants.SHOOT_COOLDOWN) {
            if (this.ownBullets(bullets).length < Constants.TANK_BULLETS_MAX) {
                const bullet = new Bullet(
                    bullets.length,
                    this.x + Math.cos(this.angle) * Constants.TANK_SIZE + 2,
                    this.y + Math.sin(this.angle) * Constants.TANK_SIZE + 2,
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
        let x = this.x
        let y = this.y
        
        if (keys['ArrowUp']) {
            x += Math.cos(this.angle) * speed;
            y += Math.sin(this.angle) * speed;
        }
        if (keys['ArrowDown']) {
            x -= Math.cos(this.angle) * speed;
            y -= Math.sin(this.angle) * speed;
        }
        if (keys['ArrowLeft']) {
            this.angle -= 0.1; // Rotate left
        }
        if (keys['ArrowRight']) {
            this.angle += 0.1; // Rotate right
        }
        return [x, y]
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
        ctx.lineTo(Constants.TANK_SIZE / 2 + 20, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    checkCollisionWithBullet(bullet: Bullet): boolean {
        // Calculate the tank's four corners based on its angle
        const halfSize = Constants.TANK_SIZE / 2;
        const corners = [
            { x: this.x - halfSize, y: this.y - halfSize },
            { x: this.x + halfSize, y: this.y - halfSize },
            { x: this.x + halfSize, y: this.y + halfSize },
            { x: this.x - halfSize, y: this.y + halfSize }
        ];

        // Rotate the corners around the center of the tank
        const rotatedCorners = corners.map(corner => rotatePoint(corner, { x: this.x, y: this.y }, this.angle));
        
        // Check if the bullet is within the rotated rectangle using SAT (Separating Axis Theorem)
        return pointInRotatedRectangle(bullet.x, bullet.y, rotatedCorners);
        
    }
    ownBullets(bullets_list: Bullet[]): Bullet[] {
        return bullets_list.filter(x => x.owner === this.peerId)
    }
    
    WallCollides(x: number, y: number, walls: Wall[]): boolean {
        return walls.some(wall => {
            return (x > wall.x && x < wall.x + wall.width &&
                y > wall.y && y < wall.y + wall.height);
        });
    }

}
