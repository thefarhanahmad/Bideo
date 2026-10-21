import { lazy } from "react";

/**
 * React.lazy with a `preload()` that resolves the module ahead of the first render.
 * Once preloaded, the component renders directly (no Suspense fallback), so
 * pre-rendered HTML is replaced by identical content without a loading flash.
 */
export function lazyWithPreload(factory) {
  let Loaded = null;
  const Lazy = lazy(factory);
  const Component = (props) => (Loaded ? <Loaded {...props} /> : <Lazy {...props} />);
  Component.preload = () =>
    factory().then((module) => {
      Loaded = module.default;
      return module;
    });
  return Component;
}
