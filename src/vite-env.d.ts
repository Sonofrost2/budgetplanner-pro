/// <reference types="vite/client" />

// @types/react 18 declares `class Component<P, S>` (2 type args) but recharts
// uses `PureComponent<P, S, SS>` (3 args). Re-declare the React Component
// class to accept the 3rd optional type parameter so recharts class components
// type-check as valid JSX elements (TS5.8 + recharts2 + @types/react 18 fix).
import 'react';
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface ComponentClass<P = {}, S = ComponentState> {}
}
declare global {
  // The React Component class needs a 3rd optional generic to match
  // PureComponent<P, S, SS>'s extends clause. Augmenting via merged interface
  // is enough — the runtime class itself is unchanged.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Component<P = {}, S = {}, SS = any> {}
  }
}
