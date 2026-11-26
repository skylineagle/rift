import type { ShaderSource } from "vgpu";
import type { BlogData } from "./types";

declare global {
  const BLOG_DATA: BlogData;
  const FLOW_SHADER: ShaderSource;
}
