import { useEffect, useRef } from "react";

import { PLUGIN_ID } from "../pluginId";

type InitializerProps = {
  setPlugin: (id: string) => void;
};

const Initializer = ({ setPlugin }: InitializerProps) => {
  const ref = useRef(setPlugin);
  ref.current = setPlugin;

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    ref.current(PLUGIN_ID);
  }, []);

  return null;
};

export { Initializer };