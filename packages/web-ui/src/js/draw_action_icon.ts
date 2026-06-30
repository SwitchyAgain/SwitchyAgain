type ActionIconCanvasContext = {
  globalCompositeOperation: string;
  fillStyle: string;
  beginPath(): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean
  ): void;
  closePath(): void;
  fill(): void;
};

function drawActionIcon(
  ctx: ActionIconCanvasContext,
  outerCircleColor: string,
  innerCircleColor?: string | null
) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = outerCircleColor;
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.5, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();

  if (innerCircleColor != null) {
    ctx.fillStyle = innerCircleColor;
  } else {
    ctx.globalCompositeOperation = "destination-out";
  }

  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.25, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
}
