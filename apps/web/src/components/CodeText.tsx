import { Fragment } from "react";

/**
 * A registry code (`maps.ird.lt · NVZRGIS/UGDYMOISTAIGOS`) that may wrap only
 * after its separators, never in the middle of a name.
 */
export function CodeText({ value }: { value: string }) {
  const parts = value.split(/(?<=[·/;])/);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </>
  );
}
