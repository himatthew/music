import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState({ show: false, msg: "" });
  const toastTimerRef = useRef(0);

  const showToast = useCallback((msg) => {
    setToast({ show: true, msg });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ show: false, msg: "" }), 2200);
  }, []);

  return { toast, showToast };
}
