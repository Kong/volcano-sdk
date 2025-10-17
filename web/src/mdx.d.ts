declare module "*.mdx" {
  import type { ComponentType } from "react";
  const component: ComponentType;
  export default component;
}
