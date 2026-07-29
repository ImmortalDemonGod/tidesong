import { createCombat } from "./game";
import { render } from "./render";

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = 1280;
canvas.height = 720;
const ctx = canvas.getContext("2d")!;

const state = createCombat();

function frame(): void {
  render(ctx, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
