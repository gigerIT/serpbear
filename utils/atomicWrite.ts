import { randomBytes } from "crypto";
import { rename, unlink, writeFile } from "fs/promises";

export const atomicWriteFile = async (
  filePath: string,
  data: string,
  encoding: BufferEncoding = "utf-8"
): Promise<void> => {
  const tempFilePath = `${filePath}.tmp.${randomBytes(8).toString("hex")}`;

  try {
    await writeFile(tempFilePath, data, { encoding });
    await rename(tempFilePath, filePath);
  } catch (error) {
    await unlink(tempFilePath).catch(() => undefined);
    throw error;
  }
};
