// CRA's Jest 27 resolver predates the router's package exports. Select
// CommonJS exports explicitly: Node 22's module-sync condition selects ESM,
// including development import.meta.hot, which Jest 27 cannot execute.
const fs = require("node:fs");
const path = require("node:path");
function requireTarget(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(requireTarget).find(Boolean);
  if (value && typeof value === "object") {
    for (const [condition, target] of Object.entries(value)) {
      if (["node", "require", "default"].includes(condition)) {
        const result = requireTarget(target);
        if (result) return result;
      }
    }
  }
  return undefined;
}
module.exports = (request, options) => {
  if (request === "react-router-dom" || request === "react-router" ||
      request.startsWith("react-router/")) {
    const packageName = request.split("/")[0];
    const packageFile = require.resolve(packageName + "/package.json", { paths: [options.basedir] });
    const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    const subpath = request === packageName ? "." : "." + request.slice(packageName.length);
    const target = requireTarget(pkg.exports?.[subpath]);
    if (!target) throw new Error("No CommonJS router export for " + request);
    return require.resolve(path.resolve(path.dirname(packageFile), target));
  }
  return options.defaultResolver(request, options);
};
