import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root } from "mdast";

export const remarkDirectiveToComponent: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, (node: any) => {
      if (
        node.type === "containerDirective" ||
        node.type === "leafDirective" ||
        node.type === "textDirective"
      ) {
        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const name = node.name;

        // Only process valid directive names (must start with a letter)
        if (!name || !/^[a-zA-Z]/.test(name)) {
          return;
        }

        // Convert directive to JSX component
        data.hName = name.charAt(0).toUpperCase() + name.slice(1) + "Directive";
        data.hProperties = {
          ...attributes,
          directiveType: name,
          directiveLabel: attributes.label || node.children?.[0]?.value || "",
        };
      }
    });
  };
};
