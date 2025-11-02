export default {
    name: "start",
    description: "Root node that defines endpoint metadata",
    schema: {
      outputs: ["next"],
      meta: ["slug", "queryParams"],
    },
  
    async run(node, req, res, context = {}) {
      // Store endpoint metadata in context for later use
      context.endpoint = {
        slug: node.data?.slug || "",
        queryParams: node.data?.queryParams || [],
      };
  
      // No output needed — it just sets up metadata
      return { output: null };
    },
  };
  