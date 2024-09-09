import { Game } from "./Game";

// Initialization
const HTMLform = document.getElementById('roomIdForm') as HTMLFormElement;

HTMLform.addEventListener('submit', (event) => {
    event.preventDefault();
    HTMLform.style.display = 'none';

    const roomId = (document.getElementById('roomId') as HTMLInputElement).value.trim();
    new Game('gameCanvas', (roomId || "public"));
});