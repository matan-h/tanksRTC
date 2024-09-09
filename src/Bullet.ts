import { GameSize, Wall } from './Types';
import { Constants } from './Constants';
export class Bullet {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    alpha: number;
    creationTime: number;
    owner: string;
    isExpired:boolean;
    
    constructor(
        id: number,
        x: number,
        y: number,
        dx: number,
        dy: number,
        owner:string
    ) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;

        this.isExpired = false
        this.alpha = 1.0;

        this.creationTime = Date.now();
        
        this.owner = owner
    }
    
    update(walls:Wall[],gameSize:GameSize) {
        this.x += this.dx;
        this.y += this.dy;
        const age = (Date.now() - this.creationTime)/1000


         if (age > Constants.BULLET_FADE_START ) {
            // Linear fade out effect
            this.alpha = Math.max(0.4, (Constants.BULLET_LIFE - age) / (Constants.BULLET_LIFE - Constants.BULLET_FADE_START));
        }
         this.reflect_edge(gameSize);
         this.reflect_walls(walls);


        return age < Constants.BULLET_LIFE
    }
    reflect_walls(walls: Wall[]) {
        // Bullet's bounding box
        const bulletLeft = this.x - Constants.BULLET_SIZE / 2;
        const bulletRight = this.x + Constants.BULLET_SIZE / 2;
        const bulletTop = this.y - Constants.BULLET_SIZE / 2;
        const bulletBottom = this.y + Constants.BULLET_SIZE / 2;

        walls.forEach(wall => {

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
                const dotProduct = this.dx * normalX + this.dy * normalY;
                this.dx -= 2 * dotProduct * normalX;
                this.dy -= 2 * dotProduct * normalY;
            }
        })

    }
    reflect_edge(gameSize:GameSize) {
        // Reflect bullets on screen edges
        if (this.x <= 0 || this.x >= gameSize.width) this.dx *= -1;
        if (this.y <= 0 || this.y >= gameSize.height) this.dy *= -1;
        this.alpha = 1
    }
    
    
    draw(ctx: CanvasRenderingContext2D): void {
            const age = (Date.now() - this.creationTime) / 1000;
            if (age > 30) return;
            ctx.save();
            ctx.globalAlpha = this.alpha || 0;
            ctx.fillStyle = 'black';
            ctx.fillRect(this.x - Constants.BULLET_SIZE / 2, this.y - Constants.BULLET_SIZE / 2, Constants.BULLET_SIZE, Constants.BULLET_SIZE);
            ctx.restore();
        
    }
}
