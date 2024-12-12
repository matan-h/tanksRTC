import { Point } from "./Types";

export class VirtualJoystick {
    private container: HTMLDivElement;
    private handle: HTMLDivElement;
    private isDragging: boolean = false;
    private startPosition: Point = { x: 0, y: 0 };
    private currentPosition: Point = { x: 0, y: 0 };
    private radius: number;
    private onMoveCallback: ((x: number, y: number) => void) | null = null;

    constructor(containerId: string, radius: number = 50) {
        this.radius = radius;
        this.container = document.createElement('div');
        this.container.id = containerId;
        this.container.classList.add('joystick-container');
        this.container.style.width = `${radius * 2}px`;
        this.container.style.height = `${radius * 2}px`;

        this.handle = document.createElement('div');
        this.handle.classList.add('joystick-handle');
        this.container.appendChild(this.handle);

        document.body.appendChild(this.container);

        this.setupEventListeners();
        this.resetHandlePosition();
    }

    private setupEventListeners() {
        this.container.addEventListener('mousedown', this.handleStart.bind(this));
        this.container.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
        document.addEventListener('mousemove', this.handleMove.bind(this));
        document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
        document.addEventListener('mouseup', this.handleEnd.bind(this));
        document.addEventListener('touchend', this.handleEnd.bind(this));
        document.addEventListener('mouseleave', this.handleEnd.bind(this));
    }

    private handleStart(event: MouseEvent | TouchEvent) {
        event.preventDefault();
        this.isDragging = true;
        this.startPosition = this.getEventPosition(event);
        this.currentPosition = { ...this.startPosition };
        this.updateHandlePosition();
    }

    private handleMove(event: MouseEvent | TouchEvent) {
        if (!this.isDragging) return;
        event.preventDefault();
        this.currentPosition = this.getEventPosition(event);
        this.updateHandlePosition();
        this.onMove();
    }

    private handleEnd() {
        this.isDragging = false;
        this.resetHandlePosition();
        this.currentPosition = { ...this.startPosition };
        this.onMove();
    }

    private getEventPosition(event: MouseEvent | TouchEvent): Point {
        if (event instanceof MouseEvent) {
            return { x: event.clientX, y: event.clientY };
        } else if (event instanceof TouchEvent) {
            const touch = event.touches[0] || event.changedTouches[0];
            return { x: touch.clientX, y: touch.clientY };
        }
        return { x: 0, y: 0 };
    }

    private updateHandlePosition() {
        const deltaX = this.currentPosition.x - this.startPosition.x;
        const deltaY = this.currentPosition.y - this.startPosition.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);

        let handleX = deltaX;
        let handleY = deltaY;

        if (distance > this.radius) {
            handleX = Math.cos(angle) * this.radius;
            handleY = Math.sin(angle) * this.radius;
        }

        this.handle.style.transform = `translate(${handleX}px, ${handleY}px)`;
    }

    private resetHandlePosition() {
        this.handle.style.transform = `translate(0px, 0px)`;
    }

    public onMove(callback?: (x: number, y: number) => void) {
        if (callback) {
            this.onMoveCallback = callback;
        } else if (this.onMoveCallback) {
            const deltaX = this.currentPosition.x - this.startPosition.x;
            const deltaY = this.currentPosition.y - this.startPosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX);

            let x = 0;
            let y = 0;

            if (distance > this.radius) {
                x = Math.cos(angle);
                y = Math.sin(angle);
            } else if (distance > 0) {
                x = deltaX / this.radius;
                y = deltaY / this.radius;
            }
            this.onMoveCallback(x, y);
        }
    }
}
