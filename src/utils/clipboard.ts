declare global {
	interface Window {
		__TAURI__: any;
	}
}

import {
	readText as tauriReadClipboard,
	writeText as tauriWriteClipboard,
} from '@tauri-apps/api/clipboard';

const isTauri = typeof window.__TAURI__ !== 'undefined';

const ensureClipboardPermission = async () => {
	if (!isTauri) return true;
	const permission = await navigator.permissions.query({
		name: 'clipboard' as PermissionName,
	});
	if (permission.state === 'denied') return false;
	return true;
};

export async function readTextFromClipboard() {
	if (!isTauri && (await ensureClipboardPermission()))
		return navigator.clipboard.readText();
	return tauriReadClipboard();
}

export async function writeTextToClipboard(text: string) {
	if (!isTauri && (await ensureClipboardPermission())) {
		return navigator.clipboard.writeText(text);
	}
	return tauriWriteClipboard(text);
}
