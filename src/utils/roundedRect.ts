export function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number = 5,
	fill = false,
	stroke = true
) {
	const radiusConfig = { tl: radius, tr: radius, br: radius, bl: radius };

	ctx.beginPath();
	ctx.moveTo(x + radiusConfig.tl, y);
	ctx.lineTo(x + width - radiusConfig.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radiusConfig.tr);
	ctx.lineTo(x + width, y + height - radiusConfig.br);
	ctx.quadraticCurveTo(
		x + width,
		y + height,
		x + width - radiusConfig.br,
		y + height
	);
	ctx.lineTo(x + radiusConfig.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radiusConfig.bl);
	ctx.lineTo(x, y + radiusConfig.tl);
	ctx.quadraticCurveTo(x, y, x + radiusConfig.tl, y);
	ctx.closePath();
	if (fill) {
		ctx.fill();
	}
	if (stroke) {
		ctx.stroke();
	}
}
