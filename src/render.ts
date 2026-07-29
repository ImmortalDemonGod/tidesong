// Rendering reads game state; it never mutates it.
import type { CombatState } from "./game";

export function render(ctx: CanvasRenderingContext2D, state: CombatState): void {
  const { width, height } = ctx.canvas;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0E3450");
  sky.addColorStop(1, "#061826");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#D8E9EE";
  ctx.font = "16px system-ui";
  ctx.fillText("TIDESONG scaffold", 24, 40);
  ctx.fillText(`turn ${state.turn}  HP ${state.player.hp}/${state.player.maxHp}  STA ${state.player.sta}/${state.player.maxSta}`, 24, 68);
  ctx.fillText(`${state.enemy.name}: ${state.enemy.hp}/${state.enemy.maxHp}`, 24, 96);
}
