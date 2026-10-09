/** Copy text to the clipboard. Returns false where the browser does not allow it (e.g. plain http). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
