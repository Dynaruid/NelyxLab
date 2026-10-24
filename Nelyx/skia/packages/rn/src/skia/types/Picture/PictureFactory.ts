import type {SkPicture} from "../Drawing.ts";

export interface PictureFactory {
  /**
   * Returns an SkPicture which has been serialized previously to the given bytes.
   * @param bytes
   */
  MakePicture(bytes: Uint8Array | ArrayBuffer | null): SkPicture | null;
}
