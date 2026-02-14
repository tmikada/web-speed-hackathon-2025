type Callback = () => void;

const callbacks = new Map<Element, Callback>();

let observer: ResizeObserver | null = null;

function getObserver(): ResizeObserver {
  if (!observer) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        callbacks.get(entry.target)?.();
      }
    });
  }
  return observer;
}

export function observeResize(el: Element, cb: Callback) {
  callbacks.set(el, cb);
  getObserver().observe(el);
}

export function unobserveResize(el: Element) {
  callbacks.delete(el);
  getObserver().unobserve(el);
}
