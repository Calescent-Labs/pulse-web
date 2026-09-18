// CRA's Jest 27 resolver predates the router's package exports.
// Use Node's export-aware resolution only for the router packages.
module.exports = (request, options) => {
  if (request === "react-router-dom" || request === "react-router" ||
      request.startsWith("react-router/")) {
    return require.resolve(request, { paths: [options.basedir] });
  }
  return options.defaultResolver(request, options);
};
