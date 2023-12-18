import { KeyboardEvent, useEffect, useRef } from 'react';
import useEventListener from './utils/useEventListener';
import './App.css';
import { drawRoundedRect } from './utils/roundedRect';
import { absRect } from './utils/math';
import { HIGHLIGHT_BLOCK } from './constant';
import { readTextFromClipboard, writeTextToClipboard } from './utils/clipboard';

const KEY_DIRECTION = {
	L: { col: 1, row: 0 },
	H: { col: -1, row: 0 },
	K: { col: 0, row: -1 },
	J: { col: 0, row: 1 },
};

const CommandBox = () => {
	return (
		<div className="command-box">
			<input type="text" value={':dra'}></input>
			<ul className="hint-list">
				<li>
					<b>Dra</b>w Box
				</li>
				<li>
					<b>Dra</b>w Table
				</li>
				<li>
					<b>Dra</b>w Arrow
				</li>
			</ul>
		</div>
	);
};

interface ContentNode {
	text: string;
	row: number;
	col: number;
}

function App() {
	let SCREEN_WIDTH = document.body.clientWidth;
	let SCREEN_HEIGHT = document.body.clientHeight;

	const CFG_FONT = "32px 'SF Mono'";
	let CELL_HEIGHT = 16 * 2;
	let CELL_WIDTH = 10 * 2;

	let COLS = ~~(SCREEN_WIDTH / CELL_WIDTH);
	let ROWS = ~~(SCREEN_HEIGHT / CELL_HEIGHT);

	let contentList: ContentNode[] = JSON.parse(
		localStorage.getItem('contentList') ?? '[]'
	);

	const persistContentList = () => {
		localStorage.setItem('contentList', JSON.stringify(contentList));
	};

	const Cursor = {
		startRow: 0,
		startCol: 0,
		row: 5,
		col: 5,
		insert: false,
		visual: false,
	};

	const fps = 60;
	const textInputRef = useRef<HTMLTextAreaElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const getContentInBox = (
		fromCol: number,
		fromRow: number,
		toCol: number,
		toRow: number
	) => {
		// Step 1: Initialize an empty 2D array
		let boxContent: string[][] = Array(toRow - fromRow + 1)
			.fill([])
			.map(() => Array(toCol - fromCol + 1).fill(' '));

		// Step 2: Iterate over the contentList array
		contentList.forEach((node) => {
			let rowDiff = node.row - fromRow;
			let colDiff = node.col - fromCol;

			// Check if the node's row and col fall within the box boundaries
			if (
				rowDiff >= 0 &&
				rowDiff <= toRow - fromRow &&
				colDiff >= 0 &&
				colDiff <= toCol - fromCol
			) {
				// Update the corresponding cell in the 2D array with the node's text
				boxContent[rowDiff][colDiff] = node.text;
			}
		});

		// Step 3: Return the 2D array
		return boxContent.map((line) => line.join('')).join('\n');
	};

	const createBox = (
		fromCol: number,
		fromRow: number,
		toCol: number,
		toRow: number
	): ContentNode => {
		const { col, row, width, height } = absRect(
			fromCol,
			fromRow,
			toCol,
			toRow
		);
		const content = Array(height)
			.fill('')
			.map((_) => Array(width).fill(' '));
		// create horizontal edges
		if (width > 1) {
			for (let c = 0; c < width; c++) {
				content[0][c] = '─';
				content[height - 1][c] = '─';
			}
		}
		// create vertial edges
		if (height > 1) {
			for (let r = 0; r < height; r++) {
				content[r][0] = '│';
				content[r][width - 1] = '│';
			}
		}
		if (width > 1 && height > 1) {
			// create corners
			content[height - 1][0] = '└';
			content[height - 1][width - 1] = '┘';
			content[0][0] = '┌';
			content[0][width - 1] = '┐';
		}
		if (width === 1 && height === 1) {
			return {
				text: HIGHLIGHT_BLOCK,
				row,
				col,
			};
		}
		return {
			text: content.map((line) => line.join('')).join('\n'),
			row,
			col,
		};
	};

	const calculateContentSize = (content: string) => {
		const lines = content.split('\n');
		const width = Math.max(
			1,
			lines.reduce((max, l) => Math.max(max, l.length), 0)
		);
		return { width, height: lines.length };
	};

	const findIndexAtCursor = () => {
		return contentList.findIndex((item) => {
			const { width, height } = calculateContentSize(item.text);
			return (
				Cursor.row >= item.row &&
				Cursor.row < item.row + height &&
				Cursor.col >= item.col &&
				Cursor.col < item.col + width
			);
		});
	};

	const showTextInput = (
		content: string,
		originalRow?: number,
		originalCol?: number
	) => {
		const ref = textInputRef.current;
		if (ref) {
			ref.value = content;
			ref.style.visibility = 'visible';
			ref.style.top = CELL_HEIGHT * (originalRow ?? Cursor.row) + 'px';
			ref.style.left = CELL_WIDTH * (originalCol ?? Cursor.col) + 'px';
			ref.dataset.row = (originalRow ?? Cursor.row) + '';
			ref.dataset.col = (originalCol ?? Cursor.col) + '';
			ref.focus();
		}
	};

	const hideTextInput = () => {
		const ref = textInputRef.current;
		if (ref) {
			ref.style.visibility = 'hidden';
			ref.style.top = '-200%';
			ref.style.left = '0px';
			ref.dataset.row = '';
			ref.dataset.col = '';
			ref.blur();
			canvasRef.current?.focus();
		}
	};

	const textInputKeyDownHandler = (e: KeyboardEvent) => {
		const ref = textInputRef.current;
		if (ref) {
			if (
				e.key === 'Escape' ||
				((e.ctrlKey || e.shiftKey) && e.key === 'Enter')
			) {
				let text = ref.value;
				if (text.indexOf('--') !== -1) {
					text = text.replace(/->/, '-▸');
					text = text.replace(/<-/, '◂-');
					text = text.replace(/-/g, '─');
				}
				const row = +(ref.dataset.row ?? '0');
				const col = +(ref.dataset.col ?? '0');
				contentList.push({
					text,
					row: row,
					col: col,
				});
				persistContentList();
				Cursor.insert = false;
				hideTextInput();
			}
		}
	};

	const globalMouseHandler = (e: globalThis.MouseEvent) => {
		// detect click on Canvas, calculate the row and col on the contentList
		// and move the Cursor to that position
		if (canvasRef.current && e.target === canvasRef.current) {
			const rect = canvasRef.current.getBoundingClientRect();
			const col = ~~((e.clientX - rect.left) / CELL_WIDTH);
			const row = ~~((e.clientY - rect.top) / CELL_HEIGHT);
			Cursor.col = col;
			Cursor.row = row;
		}
	};

	const globalKeyDownHandler = async (e: globalThis.KeyboardEvent) => {
		if (e.key === 'Escape') {
			Cursor.insert = false;
			Cursor.visual = false;
		}

		if (!Cursor.insert && !e.metaKey) {
			if (e.key === 'Enter') {
				if (Cursor.visual) {
					Cursor.visual = false;
					const node = createBox(
						Cursor.startCol,
						Cursor.startRow,
						Cursor.col + 1,
						Cursor.row + 1
					);
					console.log('DBG::NEW NODE', node);
					contentList.push(node);
					persistContentList();
				}
				e.preventDefault();
			}
			if (e.key === 'v') {
				Cursor.visual = !Cursor.visual;
				if (Cursor.visual) {
					Cursor.startRow = Cursor.row;
					Cursor.startCol = Cursor.col;
				}
				e.preventDefault();
			}
			if (e.key === 'y' && Cursor.visual) {
				Cursor.visual = false;
				const selected = getContentInBox(
					Cursor.startCol,
					Cursor.startRow,
					Cursor.col + 1,
					Cursor.row + 1
				);
				await writeTextToClipboard(selected);
				e.preventDefault();
			}
			if (e.key === 'p') {
				const content = await readTextFromClipboard();
				if (content) {
					contentList.push({
						text: content,
						row: Cursor.row,
						col: Cursor.col,
					});
					persistContentList();
				} else {
					console.error('Cannot read from clipboard');
				}
				e.preventDefault();
			}
			if (e.key === 'j') {
				if (e.ctrlKey) {
					contentList.push({
						text: '↓',
						row: Cursor.row,
						col: Cursor.col,
					});
					persistContentList();
				} else if (Cursor.row < ROWS - 1) {
					Cursor.row += 1;
				}
				e.preventDefault();
			}
			if (e.key === 'k') {
				if (e.ctrlKey) {
					contentList.push({
						text: '↑',
						row: Cursor.row,
						col: Cursor.col,
					});
					persistContentList();
				} else if (Cursor.row > 0) {
					Cursor.row -= 1;
				}
				e.preventDefault();
			}
			if (e.key === 'h') {
				if (e.ctrlKey) {
					contentList.push({
						text: '←',
						row: Cursor.row,
						col: Cursor.col,
					});
					persistContentList();
				} else if (Cursor.col > 0) {
					Cursor.col -= 1;
				}
				e.preventDefault();
			}
			if (e.key === 'l') {
				console.log(e.ctrlKey);
				if (e.ctrlKey) {
					contentList.push({
						text: '→',
						row: Cursor.row,
						col: Cursor.col,
					});
					persistContentList();
				} else if (Cursor.col < COLS - 1) {
					Cursor.col += 1;
				}
				e.preventDefault();
			}
			if (
				e.key === 'L' ||
				e.key === 'H' ||
				e.key === 'K' ||
				e.key === 'J'
			) {
				const { col, row } = KEY_DIRECTION[e.key];
				const editingIndex = findIndexAtCursor();
				if (editingIndex === -1) return;
				const editing = contentList[editingIndex];
				if (editing) {
					editing.col += col;
					editing.row += row;
					Cursor.col += col;
					Cursor.row += row;
				}
				e.preventDefault();
			}
			if (e.key === '0' || e.key === '$') {
				e.preventDefault();
				const editingIndex = findIndexAtCursor();
				if (editingIndex === -1) return;
				const editing = contentList[editingIndex];
				const { width } = calculateContentSize(editing.text);
				if (e.key === '0') {
					Cursor.col = editing.col;
				} else {
					Cursor.col = editing.col + width - 1;
				}
			}
			if (e.key === 'e') {
				e.preventDefault();
				const editingIndex = findIndexAtCursor();
				if (editingIndex === -1) return;
				const editing = contentList[editingIndex];
				contentList = contentList.filter(
					(_, index) => index !== editingIndex
				);
				persistContentList();
				Cursor.insert = true;
				showTextInput(editing?.text ?? '', editing.row, editing.col);
			}
			if (e.key === 'd') {
				contentList = contentList.filter(
					(item) => item.row !== Cursor.row
				);
				persistContentList();
				e.preventDefault();
			}
			if (e.key === 'x') {
				const editingIndex = findIndexAtCursor();
				if (editingIndex === -1) return;
				contentList = contentList.filter(
					(_, index) => index !== editingIndex
				);
				persistContentList();
				e.preventDefault();
			}
			if (e.key === 'i') {
				e.preventDefault();
				Cursor.insert = true;
				showTextInput('');
			}
		}
	};

	const documentRef = useRef<Document>(document);
	useEventListener('keydown', globalKeyDownHandler, documentRef);
	useEventListener('click', globalMouseHandler, documentRef);

	useEffect(() => {
		if (canvasRef.current) {
			canvasRef.current.width = SCREEN_WIDTH;
			canvasRef.current.height = SCREEN_HEIGHT;

			const ctx = canvasRef.current.getContext('2d');
			if (ctx) {
				window.addEventListener('resize', () => {
					initizalize();
				});

				const initizalize = () => {
					const dpi = window.devicePixelRatio;

					SCREEN_WIDTH = dpi * document.body.clientWidth;
					SCREEN_HEIGHT = dpi * document.body.clientHeight;

					if (canvasRef.current) {
						canvasRef.current.width = SCREEN_WIDTH;
						canvasRef.current.height = SCREEN_HEIGHT;
					}

					if (ctx) {
						ctx.font = CFG_FONT;
						ctx.textBaseline = 'top';
						ctx.translate(0.5, 0.5);
						ctx.scale(dpi, dpi);

						const size = ctx.measureText('#');
						CELL_WIDTH = size.width;
						CELL_HEIGHT = 16 * 2;

						COLS = ~~(SCREEN_WIDTH / (dpi * CELL_WIDTH));
						ROWS = ~~(SCREEN_HEIGHT / (dpi * CELL_HEIGHT));

						draw();
					}
				};

				const animate = () => {
					setTimeout(function () {
						requestAnimationFrame(animate);
						draw();
					}, 1000 / fps);
				};

				const draw = () => {
					ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
					ctx.beginPath();
					for (let row = 0; row <= ROWS; row++) {
						ctx.moveTo(0, row * CELL_HEIGHT);
						ctx.lineTo(SCREEN_WIDTH, row * CELL_HEIGHT);
					}
					for (let col = 0; col <= COLS; col++) {
						ctx.moveTo(col * CELL_WIDTH, 0);
						ctx.lineTo(col * CELL_WIDTH, SCREEN_HEIGHT);
					}
					ctx.strokeStyle = '#6D6A7F22';
					ctx.stroke();

					if (Cursor.visual) {
						ctx.fillStyle = '#6D6A7F33';

						const { col, row, width, height } = absRect(
							Cursor.startCol,
							Cursor.startRow,
							Cursor.col,
							Cursor.row
						);

						drawRoundedRect(
							ctx,
							col * CELL_WIDTH,
							row * CELL_HEIGHT,
							(width + 1) * CELL_WIDTH,
							(height + 1) * CELL_HEIGHT,
							3,
							true,
							true
						);
					}

					ctx.fillStyle = 'currentColor';
					const backgroundNodes = contentList.filter(
						(node) => node.text === HIGHLIGHT_BLOCK
					);
					const contentNodes = contentList.filter(
						(node) => node.text !== HIGHLIGHT_BLOCK
					);

					for (let bg of backgroundNodes) {
						const { text, row, col } = bg;
						ctx.save();
						ctx.fillStyle = 'currentColor';
						ctx.globalAlpha = 0.5;
						ctx.fillText(text, col * CELL_WIDTH, row * CELL_HEIGHT);
						ctx.restore();
					}

					for (let content of contentNodes) {
						const { text, row, col } = content;
						let lineNo = 0;
						for (let line of text.split('\n')) {
							ctx.fillText(
								line,
								col * CELL_WIDTH,
								(row + lineNo) * CELL_HEIGHT
							);
							lineNo++;
						}
					}
					ctx.fillStyle = 'currentColor';

					if (!Cursor.insert) {
						ctx.strokeStyle = Cursor.visual ? '#ff4c00' : '#00b28e';
						drawRoundedRect(
							ctx,
							Cursor.col * CELL_WIDTH,
							Cursor.row * CELL_HEIGHT,
							CELL_WIDTH,
							CELL_HEIGHT,
							2,
							false,
							true
						);
					}
				};

				animate();
				initizalize();
			}
		}
	}, [canvasRef]);

	return (
		<div className="App">
			<canvas
				ref={canvasRef}
				id="canvas"
				width="100%"
				height="100%"
			></canvas>
			<textarea
				id="input-box"
				onKeyDown={textInputKeyDownHandler}
				ref={textInputRef}
			></textarea>
		</div>
	);
}

export default App;
