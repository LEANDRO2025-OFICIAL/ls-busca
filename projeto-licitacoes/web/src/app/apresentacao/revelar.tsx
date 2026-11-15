"use client";

import { useEffect } from "react";

/**
 * Faz os blocos `.revela` da apresentação surgirem ao entrar na tela. Sem JavaScript, ou com
 * movimento reduzido, tudo já aparece: a classe `com-js` (que esconde) só entra depois que o que
 * está visível na hora foi marcado como `visivel`, para não piscar.
 */
export function Revelar() {
  useEffect(() => {
    const raiz = document.querySelector<HTMLElement>("[data-apresentacao]");
    if (!raiz || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const alvos = Array.from(raiz.querySelectorAll<HTMLElement>(".revela"));
    const altura = window.innerHeight;
    for (const el of alvos) {
      const r = el.getBoundingClientRect();
      if (r.top < altura && r.bottom > 0) el.classList.add("visivel");
    }
    raiz.classList.add("com-js");

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("visivel");
          observador.unobserve(e.target);
        }
      },
      { threshold: 0.1 },
    );
    alvos.forEach((el, i) => {
      if (el.classList.contains("visivel")) return;
      el.style.transitionDelay = `${(i % 5) * 60}ms`;
      observador.observe(el);
    });
    return () => {
      observador.disconnect();
      raiz.classList.remove("com-js");
    };
  }, []);
  return null;
}
