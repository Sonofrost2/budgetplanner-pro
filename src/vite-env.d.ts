/// <reference types="vite/client" />

// Recharts class components (PureComponent<P,S,SS>) trip TS2786/TS2607 against
// @types/react 18's 2-arg `class Component<P, S>`. Loosen JSX.ElementClass in
// both jsx-runtime modules so any object with a `render` method is accepted.
// `key`/intrinsic attributes still come from React.JSX (we only override the
// class shape used by TS to validate component types).
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface ElementClass {
      render: any;
    }
    interface IntrinsicAttributes extends React.Attributes {}
  }
}
declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface ElementClass {
      render: any;
    }
    interface IntrinsicAttributes extends React.Attributes {}
  }
}
