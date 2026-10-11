/** Internal lifecycle keys. Used by `useViewModel`; not part of the public API. */
export const ACTIVATE: unique symbol = Symbol.for("triad.viewmodel.activate") as never;
export const DEACTIVATE: unique symbol = Symbol.for("triad.viewmodel.deactivate") as never;
