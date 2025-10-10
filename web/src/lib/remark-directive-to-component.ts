import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root } from "mdast";
import type { Node } from "unist";

// Type for directive nodes
interface DirectiveNode extends Node {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name?: string;
  attributes?: Record<string, unknown>;
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
  children?: Array<{ value?: string }>;
}

export const remarkDirectiveToComponent: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, (node: Node) => {
      if (
        node.type === "containerDirective" ||
        node.type === "leafDirective" ||
        node.type === "textDirective"
      ) {
        const directiveNode = node as DirectiveNode;
        const data = directiveNode.data || (directiveNode.data = {});
        const attributes = directiveNode.attributes || {};
        const name = directiveNode.name;

        // Only process valid directive names (must start with a letter)
        if (!name || !/^[a-zA-Z]/.test(name)) {
          return;
        }

        // Convert directive to JSX component
        data.hName = name.charAt(0).toUpperCase() + name.slice(1) + "Directive";
        data.hProperties = {
          ...attributes,
          directiveType: name,
          directiveLabel: attributes.label || directiveNode.children?.[0]?.value || "",
        };
      }
    });
  };
};
