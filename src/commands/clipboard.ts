import clipboard from "clipboardy";

export async function writeClipboard(text: string): Promise<void> {
  await clipboard.write(text);
}
