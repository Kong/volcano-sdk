// Custom theme with black background and vibrant accent colors
export const customThemeDark = {
  plain: {
    color: "#ffffff",
    backgroundColor: "#000000",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#888888",
        fontStyle: "italic" as const,
      },
    },
    {
      types: ["keyword", "operator", "boolean", "null", "undefined"],
      style: {
        color: "#FF572D", // Vibrant orange-red
      },
    },
    {
      types: ["string", "char", "attr-value", "regex"],
      style: {
        color: "#FFDB29", // Bright yellow
      },
    },
    {
      types: ["function", "function-variable", "method"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["class-name", "type", "builtin"],
      style: {
        color: "#FFDB29", // Bright yellow
      },
    },
    {
      types: ["variable", "property", "constant"],
      style: {
        color: "#ffffff", // White
      },
    },
    {
      types: ["tag", "selector"],
      style: {
        color: "#FF572D", // Vibrant orange-red
      },
    },
    {
      types: ["attr-name"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["number"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["punctuation", "symbol"],
      style: {
        color: "#ffffff", // White
      },
    },
    {
      types: ["inserted"],
      style: {
        color: "#FFDB29",
      },
    },
    {
      types: ["deleted"],
      style: {
        color: "#FF572D",
      },
    },
  ],
};

// Custom theme with white background and same vibrant accent colors
export const customThemeLight = {
  plain: {
    color: "#000000",
    backgroundColor: "#ffeae5",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#666666",
        fontStyle: "italic" as const,
      },
    },
    {
      types: ["keyword", "operator", "boolean", "null", "undefined"],
      style: {
        color: "#FF572D", // Vibrant orange-red
      },
    },
    {
      types: ["string", "char", "attr-value", "regex"],
      style: {
        color: "#009a3e", // Green
      },
    },
    {
      types: ["function", "function-variable", "method"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["class-name", "type", "builtin"],
      style: {
        color: "#009a3e", // Green
      },
    },
    {
      types: ["variable", "property", "constant"],
      style: {
        color: "#000000", // Black
      },
    },
    {
      types: ["tag", "selector"],
      style: {
        color: "#FF572D", // Vibrant orange-red
      },
    },
    {
      types: ["attr-name"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["number"],
      style: {
        color: "#D453A8", // Magenta/pink
      },
    },
    {
      types: ["punctuation", "symbol"],
      style: {
        color: "#000000", // Black
      },
    },
    {
      types: ["inserted"],
      style: {
        color: "#009a3e",
      },
    },
    {
      types: ["deleted"],
      style: {
        color: "#FF572D",
      },
    },
  ],
};
