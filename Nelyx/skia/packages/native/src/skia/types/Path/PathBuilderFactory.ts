import type {SkPath} from "../Drawing.ts";
import type {SkPathBuilder} from './PathBuilder.ts';

export interface PathBuilderFactory {
  /**
   * Creates a new empty PathBuilder.
   */
  Make(): SkPathBuilder;

  /**
   * Creates a new PathBuilder initialized with the given path's contents.
   * @param path - path to copy into the builder
   */
  MakeFromPath(path: SkPath): SkPathBuilder;
}
