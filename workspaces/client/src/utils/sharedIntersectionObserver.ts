type Callback = (entry: IntersectionObserverEntry) => void;

const callbacks = new Map<Element, Callback>();

let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          callbacks.get(entry.target)?.(entry);
        }
      },
      { rootMargin: '200px' },
    );
  }
  return observer;
}

export function observe(el: Element, cb: Callback) {
  callbacks.set(el, cb);
  getObserver().observe(el);
}

export function unobserve(el: Element) {
  callbacks.delete(el);
  getObserver().unobserve(el);
}
