import { parseFile } from "./spreadsheet-parser";
self.onmessage = (
  event: MessageEvent<{ buffer: ArrayBuffer; filename: string }>,
) => {
  try {
    self.postMessage({
      result: parseFile(event.data.buffer, event.data.filename),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Could not read this file.",
    });
  }
};
