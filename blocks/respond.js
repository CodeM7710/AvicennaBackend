import { interpolate } from "../lib/vars.js";

export default async function respond(node, req, res, context) {
  const message = interpolate(node.data.message || "", context);
  res.send(message);
}
