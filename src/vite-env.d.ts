/// <reference types="vite/client" />

// Recharts uses `PureComponent<P, S, SS>` (3 type args) while @types/react 18
// declares `class Component<P, S>` (2 args). The 3-arg interface exists via
// declaration merging but the class signature doesn't match, causing
// TS2786/TS2607 on every recharts JSX usage. Re-declare the class with the
// optional 3rd arg so recharts components type-check as JSX elements.
import 'react';
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class Component<P = {}, S = {}, SS = any> {
    constructor(props: Readonly<P> | P);
    constructor(props: P, context: any);
    setState<K extends keyof S>(
      state:
        | ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null)
        | (Pick<S, K> | S | null),
      callback?: () => void,
    ): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
    readonly props: Readonly<P>;
    state: Readonly<S>;
    context: any;
    refs: { [key: string]: any };
  }
}
