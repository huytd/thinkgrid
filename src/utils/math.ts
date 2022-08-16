export const absRect = (x1: number, y1: number, x2: number, y2: number): { col: number, row: number, width: number, height: number } => {
	const col = x1 <= x2 ? x1 : x2;
	const row = y1 <= y2 ? y1 : y2;
	return {
		col, row,
		width: Math.abs(x1 - x2),
		height: Math.abs(y1 - y2)
	}
};